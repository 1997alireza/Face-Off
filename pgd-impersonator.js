class ImpersonatorModel {
    // usage: let obj = await ImpersonatorModel.build();
    constructor(built) {
        if (!built) {
            throw new Error('Cannot be called directly');
        }
        this.victimEmbeddings = undefined;
        this.embeddingModel = undefined;
    }

    static async build() {
        let theObject = new ImpersonatorModel(true);
        theObject.embeddingModel = await tf.loadGraphModel(getUrlOfData('models/Inception-resnet/model.json'));
        return theObject;
    }

    meanDistanceToVictim(imageTensor) {
        let imageTensorArray = imageTensor.reshape([1, 160, 160, 3]);
        let imageEmbedding = this.evalEmbedding(imageTensorArray);
        let emb = [imageEmbedding.dataSync()];
        let victimEmbeddingT = this.victimEmbeddings[0].map((col, i) => this.victimEmbeddings.map(row => row[i]));
        let dist = matrixMultiply(emb, victimEmbeddingT);
        dist = dist[0]; // [1, ?] -> [?]
        let sum = dist.reduce((previous, current) => current += previous);
        return (sum / dist.length);
    }

    evalEmbeddingUnReshaped(imageTensor){
        let imageTensorArray = imageTensor.reshape([1, 160, 160, 3]);
        return this.evalEmbedding(imageTensorArray);
    }

    evalEmbedding(input) {
        if (!input instanceof tf.Tensor) {
            input = tf.tensor(input)
        }
        input = input.toFloat();
        // normalizing
        let imageInput2 = input.sub(tf.scalar(127.5, tf.float32));
        input = imageInput2.mul(tf.scalar(1 / 128.0, tf.float32));
        let prelogits = this.embeddingModel.predict(input);
        prelogits = prelogits.squeeze();
        let embedding = tf.div(prelogits, tf.sqrt(tf.maximum(tf.dot(prelogits, prelogits), 1e-12)));// L2 normalization
        return embedding
    }

    async setTarget(name, victimsEmbeddings) {
        let theVictimEmbeddings = victimsEmbeddings[name];
        this.victimEmbeddings = tf.tensor(theVictimEmbeddings, tf.float32);
    }

    structure(inputTensor) {
        let rnd = tf.randomUniform([], 135, 160, tf.int32);
        rnd = rnd.toInt();
        let rescaled = tf.image.resizeNearestNeighbor(
            inputTensor, [rnd.dataSync()[0], rnd.dataSync()[0]]);

        let hRem = tf.sub(tf.scalar(160), rnd);
        let wRem = tf.sub(tf.scalar(160), rnd);

        let padLeft = tf.randomUniform([], 0, wRem.dataSync()[0], tf.int32).toInt();
        let padRight = tf.sub(wRem, padLeft).toInt();
        let padTop = tf.randomUniform([], 0, hRem.dataSync()[0], tf.int32).toInt();
        let padBottom = tf.sub(hRem, padTop).toInt();

        let paddings = [[padTop.dataSync()[0], padBottom.dataSync()[0]], [
            padLeft.dataSync()[0], padRight.dataSync()[0]], [0, 0]];

        let padded = tf.pad(rescaled, paddings);
        // console.log("shape:",padded.shape);
        padded = padded.reshape([1, 160, 160, 3]);
        inputTensor = inputTensor.reshape([1, 160, 160, 3]);
        let random = tf.randomUniform([1]).dataSync()[0];
        let output = tf.where(tf.tensor1d([random < 0.9]),
            padded, inputTensor);
        return output
    }

    PGDAttack(imageBatch, eps = 14, maxIter = 90) {
        let victimEmbeddings = this.victimEmbeddings;
        let structure = this.structure.bind(this);
        let embeddingModel = this.embeddingModel;

        let adversarial = undefined;

        function getObjective(imageInput) {

            imageInput = structure(imageInput);
            imageInput = imageInput.sub(tf.scalar(127.5, tf.float32));
            imageInput = imageInput.mul(tf.scalar(1 / 128.0, tf.float32));
            imageInput = tf.add(imageInput, tf.randomUniform([160, 160, 3], -1e-2, 1e-2));
            let reshaped = imageInput.reshape([1, 160, 160, 3]);
            let prelogits = embeddingModel.predict(reshaped);
            prelogits = prelogits.squeeze();
            let embeddings = tf.div(prelogits, tf.sqrt(tf.maximum(tf.dot(prelogits, prelogits), 1e-12))); // L2 normalization
            embeddings = tf.reshape(embeddings, [512, 1]);
            let objective = tf.mean(tf.matMul(victimEmbeddings, embeddings));// must be maximized
            return objective
        }

        function oneStepAttack(image, grad) {
            let gradFunction = tf.grad(getObjective);
            let noise = gradFunction(image);
            // div on L2 norm
            noise = tf.div(noise, tf.mean(tf.abs(noise), [0, 1, 2], true));
            // momentum
            noise = tf.add(tf.mul(grad, tf.scalar(0.9)), noise); // after this, we apply sign on noise, so it will be normalized
            let adv = tf.add(image, tf.mul(tf.sign(noise), tf.scalar(1.0)));

            adv = adv.sub(lowerBound);
            adv = tf.clipByValue(adv, 0, 255.);
            adv = adv.add(lowerBound);
            adv = adv.sub(upperBound);
            adv = tf.clipByValue(adv, -255., 0);
            adv = adv.add(upperBound);
            return [adv, noise]
        }

        let input = imageBatch.toFloat();

        let lowerBound = tf.clipByValue(tf.sub(input, tf.mul(tf.onesLike(input), eps)), 0, 255.);
        let upperBound = tf.clipByValue(tf.add(input, tf.mul(tf.onesLike(input), eps)), 0, 255.);
        let grad = tf.zerosLike(input);
        for (let i = 0; i < maxIter; i++) {

            let res = tf.tidy(() => {
                let res_in =
                    oneStepAttack(input, grad);
                tf.dispose(input);
                tf.dispose(grad);
                return res_in;
            });
            input = res[0];
            grad = res[1];

        }
        adversarial = input.toInt();
        return adversarial
    }

}

/**
 *
 * @param imageObject
 * @param eps
 * @param autoTargeting: can be true(use the code to choose the victim) or false(user should select it)
 * @param targetOption: if autoTargeting is true, it's the victim mode. else it's an array contains the source ('celebrity' or 'custom') and the name of the victim.
 * @param nearestVictim
 * @returns {Promise<*>}
 *          .then: Int32Array(width*height*3)
 */
async function attackOnTarget(imageObject, eps, autoTargeting, targetOption, nearestVictim = false) {
    let detectedFaces = await faceDetector(imageObject);

    let victimsEmbeddings = undefined, chosedVictimEmbeddings = undefined;
    if(autoTargeting) {
        victimsEmbeddings = await importVictimsEmbedding(targetOption);
    }
    else {
        victimsEmbeddings = await importVictimsEmbedding(targetOption[0]);
        chosedVictimEmbeddings = victimsEmbeddings[targetOption[1]];
    }
    let model = await ImpersonatorModel.build();

    let imageTensor = tf.browser.fromPixels(imageObject);
    for (let i in detectedFaces) {
        let scaledFaceTensor = await imageObjectToTensor(detectedFaces[i].scaled);

        let bbox = detectedFaces[i].box;
        console.log('on face number ' + i + ', on [', bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height, ']');

        if(autoTargeting) {
            // let randomTargeting = true;
            // if (randomTargeting) {
            //     let keys = Object.keys(victimsEmbeddings);
            //     let randomIndex1 = Math.floor(Math.random() * keys.length);
            //     // let randomIndex2 = Math.floor(Math.random() * keys.length);
            //
            //     model.victimEmbeddings = victimsEmbeddings[keys[randomIndex1]];
            //     // model.victimEmbeddings = victimsEmbeddings[keys[randomIndex1]].concat(
            //     //     victimsEmbeddings[keys[randomIndex2]]
            //     // );
            //
            //     console.log('Choosed random target: ', keys[randomIndex1]);
            //     console.log("Similarity of ORIG: ", model.meanDistanceToVictim(scaledFaceTensor));
            // } else {
            let bestSimilarity = undefined,
                bestVictimName = undefined;
            if (nearestVictim) bestSimilarity = -Infinity;
            else bestSimilarity = Infinity;

            // victim finder
            for (let victimName in victimsEmbeddings) {
                model.victimEmbeddings = victimsEmbeddings[victimName];
                let similarity = model.meanDistanceToVictim(scaledFaceTensor);
                if ((similarity > bestSimilarity) === nearestVictim) {
                    bestSimilarity = similarity;
                    bestVictimName = victimName;
                }
            }

            console.log('Choosed target: ', bestVictimName);
            console.log("Similarity of ORIG: ", bestSimilarity);

            model.victimEmbeddings = victimsEmbeddings[bestVictimName];
            // }
        }
        else {
            model.victimEmbeddings = chosedVictimEmbeddings;
        }

        // It's a random attack for testing
        // let attackedFaceTensor = tf.add(
        //     scaledFaceTensor,
        //     tf.randomUniform(scaledFaceTensor.shape, 0, 200, 'int32'))
        //     .minimum(tf.scalar(255, 'int32'))
        //     .maximum(tf.scalar(0, 'int32'));

        let attackedFaceTensor = tf.tidy(() => {
            return model.PGDAttack(scaledFaceTensor, eps);
        });
        imageTensor = await replaceAttackedFace(imageTensor, attackedFaceTensor, scaledFaceTensor, bbox);
    }
    console.log('perturbed image is ready');
    return imageTensor.dataSync();
}

/**
 * it would replace the embeddings if the victim name is duplicated
 * @param files
 * @param victimName
 */
function addTargetVictim(victimName, files){
    return new Promise(async resolve => {
        let model = await
        ImpersonatorModel.build();
        let newVictimEmbeddings = [];

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            var dataUrl = await
            fileToDataUrl(file);
            var image = await
            Jimp.read(dataUrl);

            let imageObject = await
            imageObjectExtractorOrienFixing(file);
            image.bitmap.width = imageObject.width;
            image.bitmap.height = imageObject.height; // fixing orientation may affect on dimensions

            let detectedFaces = await
            faceDetector(imageObject);
            for (let i in detectedFaces) {
                let scaledFaceTensor = await
                imageObjectToTensor(detectedFaces[i].scaled);
                newVictimEmbeddings.push(Array.from(model.evalEmbeddingUnReshaped(scaledFaceTensor).dataSync()));
            }
        }

        getStorageValue('custom_victims', (victimsDict) => {
            victimsDict = victimsDict || {};
            victimsDict[victimName] = newVictimEmbeddings;
            setStorageValue('custom_victims', victimsDict);
            resolve();
        });
    });
}
