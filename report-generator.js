async function reportGenerator(imageTensor, eps, iter, scaledFaceTensors, bboxs, model, keepOriginalQuality = true) {


    let bbox = bboxs[0];
    console.log('on face number ' + 0 + ', on [', bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height, ']');


    let attackedFaceTensor = tf.tidy(() => {
        return model.PGDAttack(scaledFaceTensors[0], eps, iter);
    });
    imageTensor = await replaceAttackedFace(imageTensor, attackedFaceTensor, scaledFaceTensors[0], bbox, keepOriginalQuality);
    // }
    console.log('perturbed image is ready');
    return imageTensor.dataSync()

}


async function performTest(image, file, name) {

    let imageObject = await imageFileToImageObject(file);
    let imageTensor = tf.browser.fromPixels(imageObject);
    let epsilons = [8, 12, 16];
    let iter = 90;
    let detectedFaces = await faceDetector(imageObject);
    let nearestVictim = false;
    let victimsEmbeddings = await importVictimsEmbedding();
    let model = await ImpersonatorModel.build();

    let scaledFaceTensors = [];
    let bboxs = [];
    for (let i in detectedFaces) {
        let scaledFace = detectedFaces[i].scaled;
        // let scaledFaceTensor = undefined;
        switch (getBrowserType()) {
            case 'chrome':
                scaledFaceTensors.push(tf.browser.fromPixels(scaledFace));
                break;
            case 'firefox':
                let scaledFaceImageData = await imageObjectToImageData(scaledFace);
                scaledFaceTensors.push(imageDataToTensor(scaledFaceImageData));
                break;
        }
        bboxs.push(detectedFaces[i].box);
    }

    let header = latexTableHeader(epsilons, name);
    name = name.split(" ").join("-");
    let footer = latexTableFooter();
    let body = "";

    for (let j = 0; j < 3; j++) {
        let targetName = undefined;
        let similarity = 0;
        let mode = "Random";
        let fileNames = [];
        // let similarities = [];
        if (j === 0) {

            let bestSimilarity = undefined,
                bestVictimName = undefined;
            if (nearestVictim) bestSimilarity = -Infinity;
            else bestSimilarity = Infinity;

            // victim finder
            for (let victimName in victimsEmbeddings) {
                model.victimEmbeddings = victimsEmbeddings[victimName];
                let similarity = model.meanDistanceToVictim(scaledFaceTensors[0]);
                if ((similarity > bestSimilarity) === nearestVictim) {
                    bestSimilarity = similarity;
                    bestVictimName = victimName;
                }
            }
            targetName = bestVictimName;
            console.log('Choosed target: ', bestVictimName);
            console.log("Similarity of ORIG: ", bestSimilarity);
            similarity = bestSimilarity;
            model.victimEmbeddings = victimsEmbeddings[bestVictimName];


        } else {

            let keys = Object.keys(victimsEmbeddings);
            let randomIndex1 = Math.floor(Math.random() * keys.length);
            // let randomIndex2 = Math.floor(Math.random() * keys.length);

            model.victimEmbeddings = victimsEmbeddings[keys[randomIndex1]];
            targetName = keys[randomIndex1];
            // model.victimEmbeddings = victimsEmbeddings[keys[randomIndex1]].concat(
            //     victimsEmbeddings[keys[randomIndex2]]
            // );

            console.log('Choosed random target: ', keys[randomIndex1]);
            console.log("Similarity of ORIG: ", model.meanDistanceToVictim(scaledFaceTensors[0]));
            similarity = model.meanDistanceToVictim(scaledFaceTensors[0]);
            // console.log('Choosed random targets: ', keys[randomIndex1], ', ', keys[randomIndex2]);
        }
        console.log("TARGET NAME", targetName);
        for (let i = 0; i < 3; i++) {

            let bitmap3ChannelArray = undefined;

            if (j === 0) {
                console.log("furthest");
                mode = "Furthest";
                bitmap3ChannelArray = await reportGenerator(imageTensor, epsilons[i], iter, scaledFaceTensors, bboxs, model, true);

            } else {
                console.log("random");
                bitmap3ChannelArray = await reportGenerator(imageTensor, epsilons[i], iter, scaledFaceTensors, bboxs, model, true);

            }
            //
            for (let i = 0; i < bitmap3ChannelArray.length / 3; i++) { // i: index of each pixel
                image.bitmap.data[4 * i] = bitmap3ChannelArray[3 * i];
                image.bitmap.data[4 * i + 1] = bitmap3ChannelArray[3 * i + 1];
                image.bitmap.data[4 * i + 2] = bitmap3ChannelArray[3 * i + 2];
                // and we don't edit the alpha (image.bitmap.data[4*i + 3])
            }

            var mime = image.getMIME();
            let dataArray = await image.getBufferAsync(mime);

            let fileName = name + "-to-" + targetName + "-" + mode + "-" + "eps" + epsilons[i];
            fileNames.push(fileName);
            let newFile = new File([dataArray], fileName + ".jpg", {type: mime,});
            saveAs(newFile);
        }


        let row = latexTableRow(mode, targetName, fileNames, similarity, j === 0);
        body = body + row;
    }

    let latexContent = header + body + footer;

    var blob = new Blob([latexContent], {type: "text/plain;charset=utf-8"});
    saveAs(blob, name + ".txt");


}

function latexTableRow(mode, targetName, fileNames, similarity, first = false) {
    targetName = targetName.split("_").join(" ");
    if (first) {

        return "\\includegraphics[width=0.33\\textwidth]{" + fileNames[0] + "}\n" +
            " &  \\includegraphics[width=0.33\\textwidth]{" + fileNames[1] + "}\n" +
            "   &  \\includegraphics[width=0.33\\textwidth]{" + fileNames[2] + "}\n" +
            "  \\\\ \n" +
            "   \\end{tabular}\n" +
            "   \n" +
            "\\\\ " + mode + " - " + targetName + ", Similarity: " + similarity.toFixed(3) + ",  BetaFace:-" + " Clarifai:-" +
            "\\newline\n" +
            "\n"

    } else {
        return "\\begin{tabular}{ c c c }\n" +
            "\\includegraphics[width=0.33\\textwidth]{" + fileNames[0] + "}\n" +
            " &  \\includegraphics[width=0.33\\textwidth]{" + fileNames[1] + "}\n" +
            "   &  \\includegraphics[width=0.33\\textwidth]{" + fileNames[2] + "}\n" +
            "  \\\\ \n" +
            "   \\end{tabular}\n" +
            "   \n" +
            "\\\\ " + mode + " - " + targetName + ", Similarity: " + similarity.toFixed(3) + ", BetaFace:-" + " Clarifai:-" +
            " \\newline\n" +
            "\n"

    }
}


function latexTableHeader(epsilons, name) {
    return "\\subsection{" + name + "}" + "\\begin{center}\n" +
        "\\begin{tabular}{ c c c }\n" +
        "  eps:" + epsilons[0] + " & eps: " + epsilons[1] + " & eps:" + epsilons[2] + " \\\\ "

}

function latexTableFooter() {
    return "\\end{center}\n"
}