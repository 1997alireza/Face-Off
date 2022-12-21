function getImageOrientation(imageFile) {
    var reader = new FileReader();
    return new Promise(resolve => {
        reader.onload = function (e) {
            var view = new DataView(e.target.result);
            if (view.getUint16(0, false) != 0xFFD8) {
                return resolve(-2);
            }
            var length = view.byteLength, offset = 2;
            while (offset < length) {
                if (view.getUint16(offset + 2, false) <= 8) return resolve(-1);
                var marker = view.getUint16(offset, false);
                offset += 2;
                if (marker == 0xFFE1) {
                    if (view.getUint32(offset += 2, false) != 0x45786966) {
                        return resolve(-1);
                    }

                    var little = view.getUint16(offset += 6, false) == 0x4949;
                    offset += view.getUint32(offset + 4, little);
                    var tags = view.getUint16(offset, little);
                    offset += 2;
                    for (var i = 0; i < tags; i++) {
                        if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                            return resolve(view.getUint16(offset + (i * 12) + 8, little));
                        }
                    }
                } else if ((marker & 0xFF00) != 0xFF00) {
                    break;
                } else {
                    offset += view.getUint16(offset, false);
                }
            }
            return resolve(-1);
        };
        reader.readAsArrayBuffer(imageFile);
    });
}

function getCorrectedImageOrientation(imageFile, orientation) {
    return new Promise(resolve => {
        loadImage.parseMetaData(imageFile, function (data) {
            //default image orientation
            var orientation = 0;
            //if exif data available, update orientation
            if (data.exif) {
                orientation = data.exif.get('Orientation');
            }
            var loadingImage = loadImage(
                imageFile,
                function (canvas) {
                    //here's the base64 data result
                    var base64data = canvas.toDataURL('image/jpeg');
                    let imageObject = new Image();
                    imageObject.src = base64data;
                    imageObject.onload = function () {
                        resolve(imageObject);
                    }
                }, {
                    //should be set to canvas : true to activate auto fix orientation
                    canvas: true,
                    orientation: orientation
                }
            );
        });
    });
}

function imageObjectToImageData(imageObject) {
    return new Promise(resolve => {
        let canvas = document.createElement('canvas');
        canvas.width = imageObject.width;
        canvas.height = imageObject.height;
        let ctx = canvas.getContext('2d');
        let img = new Image;
        img.src = imageObject.src;
        img.onload = function () {
            ctx.drawImage(img, 0, 0, img.width, img.height);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
    });
}

function imageDataToImageObject(imageData) {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    let imageObject = new Image();
    imageObject.src = canvas.toDataURL();
    imageObject.width = imageData.width;
    imageObject.height = imageData.height;
    return imageObject;
}

async function imageFileToImageObject(file) {
    return new Promise(resolve => {
        var canvas = document.createElement('Canvas');
        var context = canvas.getContext("2d");

        var imageObject = new Image();


        if (file.type.match('image.*')) {
            var reader = new FileReader();
            // Read in the image file as a data URL.
            reader.onload = function (evt) {
                if (evt.target.readyState === FileReader.DONE) {
                    imageObject.onload = () => {
                        context.drawImage(imageObject, 0, 0);
                        resolve(imageObject);
                    };
                    imageObject.src = evt.target.result;
                    imageObject.crossOrigin = "anonymous";
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert("not an image");
        }
    });

}

function imageDataToTensor(imageData) {
    let imageData3D = [];
    let height = imageData.height;
    let width = imageData.width;

    for (let j = 0; j < width; j++) {
        imageData3D.push([]);
        for (let k = 0; k < height; k++) {
            let idx = (k * height + j) * 4;
            let arr = [imageData.data[idx],
                imageData.data[idx + 1],
                imageData.data[idx + 2]];
            imageData3D[j].push(arr);
        }
    }
    return tf.tensor(imageData3D);
}

async function imageObjectToTensor(imageObject){
    switch (getBrowserType()) {
        case 'chrome':
            return tf.browser.fromPixels(imageObject);
        case 'firefox':
            let imageData = await imageObjectToImageData(imageObject);
            return imageDataToTensor(imageData);
    }
}

async function imageObjectExtractorOrienFixing(imageFile, fixOrientation = true){
    if (fixOrientation) {
        let fixedOrientationImageObject = await getCorrectedImageOrientation(imageFile,
            await getImageOrientation(imageFile));
        fixedOrientationImageObject.crossOrigin = "anonymous";
        return fixedOrientationImageObject;
    }
    else {
        // let dataClampedArray = new Uint8ClampedArray(image.bitmap.data);
        // let imageData = new ImageData(dataClampedArray, width, height);
        // let imageObject = imageDataToImageObject(imageData);  // it's working on chrome but not firefox

        return await imageFileToImageObject(imageFile);
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = function (e) {
            resolve(e.target.result);
        };
        reader.readAsDataURL(file);
    });
}

function displayImage(imageObject, addLabel = false, labelColor = '#ff8833', labelText = '') { // TODO: delete on product version
    let canvas = document.createElement('canvas');
    canvas.width = imageObject.width;
    canvas.height = imageObject.height;
    let ctx = canvas.getContext('2d');

    let img = new Image();
    img.src = imageObject.src;
    img.onload = function () {
        ctx.drawImage(img, 0, 0);

        if (addLabel) {
            ctx.fillStyle = labelColor;
            let w = canvas.width / 5,
                h = Math.min(canvas.height / 5, canvas.width / 10);
            ctx.fillRect(w * .1, h * .1, w * 1.1, h * 1.1);

            ctx.fillStyle = '#000000';
            ctx.font = "20px Georgia";
            ctx.fillText(labelText, w * .2, h * .7);
        }
    };
    img.src = imageObject.src;

    document.body.append(canvas);
}

function displayCanvas(canvas, addLabel = false, labelColor = "#ff8833") { // TODO: delete on product version
    let ctx = canvas.getContext('2d');
    if (addLabel) {
        ctx.fillStyle = labelColor;
        let w = canvas.width / 5,
            h = Math.min(canvas.height / 5, canvas.width / 10);
        ctx.fillRect(w * .1, h * .1, w * 1.1, h * 1.1);

        ctx.fillStyle = '#000000';
        ctx.font = "20px Georgia";
        ctx.fillText("canvas", w * .2, h * .7);
    }
    document.body.append(canvas);
}

function cropImage(imageObject, startX, startY, newWidth, newHeight, marginFactor = 0, squareCrop = false, roundToInt = true) {
    /**       |
     Y
     |
     _ _ _X_ _|
     |-----w-----|
     |           |
     |    FACE   h
     |           |
     |___________|
     */
    startX -= newWidth * marginFactor;
    startY -= newHeight * marginFactor;
    newWidth *= (marginFactor * 2 + 1);
    newHeight *= (marginFactor * 2 + 1);

    if (squareCrop) {
        if (newHeight > newWidth) {
            if (newHeight > imageObject.width) {
                newWidth = imageObject.width;
                startX = 0;
                startY += (newHeight - imageObject.width) / 2;
                newHeight = newWidth;
            } else {
                startX -= (newHeight - newWidth) / 2;
                startX = Math.max(startX, 0);
                newWidth = newHeight;
            }
        } else {
            if (newWidth > imageObject.height) {
                newHeight = imageObject.height;
                startY = 0;
                startX = (newWidth - imageObject.height) / 2;
                newWidth = newHeight;
            } else {
                startY -= (newWidth - newHeight) / 2;
                startY = Math.max(startY, 0);
                newHeight = newWidth;
            }
        }
    }

    if (roundToInt) {
        startX = Math.round(startX);
        startY = Math.round(startY);
        newWidth = Math.round(newWidth);
        newHeight = Math.round(newHeight);
    }

    /* code from this web page: https://yellowpencil.com/blog/cropping-images-with-javascript */
    let tnCanvas = document.createElement('canvas');
    let tnCanvasContext = tnCanvas.getContext('2d');
    tnCanvas.width = newWidth;
    tnCanvas.height = newHeight;

    /* use the sourceCanvas to duplicate the entire image. This step was crucial for iOS4 and under devices.
    Follow the link at the end of this post to see what happens when you don’t do this */
    let bufferCanvas = document.createElement('canvas');
    let bufferContext = bufferCanvas.getContext('2d');
    bufferCanvas.width = imageObject.width;
    bufferCanvas.height = imageObject.height;
    bufferContext.drawImage(imageObject, 0, 0);

    /* now we use the drawImage method to take the pixels from our bufferCanvas and draw them into our thumbnail canvas */
    tnCanvasContext.drawImage(bufferCanvas, startX, startY, newWidth, newHeight, 0, 0, newWidth, newHeight);
    let croppedImageObject = new Image();
    croppedImageObject.src = tnCanvas.toDataURL();
    croppedImageObject.width = newWidth;
    croppedImageObject.height = newHeight;
    return [croppedImageObject, startX, startY, newWidth, newHeight];
}


function resizeImage(imageObject, newWidth, newHeight) {
    return new Promise((resolve, reject) => {
        // displayImage(imageObject, true, undefined, 'original');
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        canvas.width = newWidth;
        canvas.height = newHeight;
        let tempImage = new Image();
        tempImage.onload = function () {
            ctx.drawImage(tempImage, 0, 0, tempImage.width, tempImage.height, 0, 0, newWidth, newHeight);

            let resizedImageObject = new Image();
            resizedImageObject.width = newWidth;
            resizedImageObject.height = newHeight;

            resizedImageObject.onload = function () {

                // displayCanvas(canvas, true);
                // displayImage(resizedImageObject, true, undefined, 'resized');
                resolve(resizedImageObject);
            };
            resizedImageObject.src = canvas.toDataURL(); // actually does not give the data, you get it on few lines higher!
        };
        tempImage.src = imageObject.src;
    })
}

/**
 *
 * @param imgTensor
 * @param attackedFaceTensor
 * @param scaledFaceTensor
 * @param bbox
 * @param keepOriginalQuality
 * @returns {Promise<void>}
 */
async function replaceAttackedFace(imgTensor, attackedFaceTensor, scaledFaceTensor, bbox, keepOriginalQuality = true) {
    if (keepOriginalQuality) {
        let differenceModelSized = tf.sub(attackedFaceTensor, scaledFaceTensor);
        let imageArray = imgTensor.arraySync();


        // --resize each channel(R, G, B) separately
        // let modelShape = differenceModelSized.shape;
        // let differenceModelSizedRedArray = tf.zerosLike(differenceModelSized).arraySync(),
        //     differenceModelSizedGreenArray = tf.zerosLike(differenceModelSized).arraySync(),
        //     differenceModelSizedBlueArray = tf.zerosLike(differenceModelSized).arraySync();
        //
        // let differenceModelSizedArray = differenceModelSized.arraySync();
        //
        // for(let i = 0; i < modelShape[0]; i++){
        //     for(let j = 0; j < modelShape[1]; j++){
        //         differenceModelSizedRedArray[i][j][0] = differenceModelSizedArray[i][j][0];
        //         differenceModelSizedGreenArray[i][j][1] = differenceModelSizedArray[i][j][1];
        //         differenceModelSizedBlueArray[i][j][2] = differenceModelSizedArray[i][j][2];
        //     }
        // }
        //
        // let differenceResizedRedArray = tf.image.resizeNearestNeighbor(tf.tensor(differenceModelSizedRedArray), [bbox.height, bbox.width]).arraySync();
        // let differenceResizedGreenArray = tf.image.resizeNearestNeighbor(tf.tensor(differenceModelSizedGreenArray), [bbox.height, bbox.width]).arraySync();
        // let differenceResizedBlueArray = tf.image.resizeNearestNeighbor(tf.tensor(differenceModelSizedBlueArray), [bbox.height, bbox.width]).arraySync();
        //
        // for(let i = 0; i < bbox.height; i++){
        //     for(let j = 0; j < bbox.width; j++) {
        //         imageArray[i + bbox.y][j + bbox.x][0] = Math.max(Math.min(imageArray[i + bbox.y][j + bbox.x][0] + differenceResizedRedArray[i][j][0], 255), 0);
        //         imageArray[i + bbox.y][j + bbox.x][1] = Math.max(Math.min(imageArray[i + bbox.y][j + bbox.x][1] + differenceResizedGreenArray[i][j][1], 255), 0);
        //         imageArray[i + bbox.y][j + bbox.x][2] = Math.max(Math.min(imageArray[i + bbox.y][j + bbox.x][2] + differenceResizedBlueArray[i][j][2], 255), 0);
        //     }
        // }


        // --resize all channels together
        let differenceResizedArray = tf.image.resizeNearestNeighbor(differenceModelSized, [bbox.height, bbox.width]).arraySync();
        for (let i = 0; i < bbox.height; i++) {
            for (let j = 0; j < bbox.width; j++) {
                for (let k = 0; k < 3; k++) {
                    imageArray[i + bbox.y][j + bbox.x][k] = Math.max(Math.min(imageArray[i + bbox.y][j + bbox.x][k] + differenceResizedArray[i][j][k], 255), 0);
                }
            }
        }
        return tf.tensor(imageArray, undefined, 'int32');
    } else {
        let resizedAttackedFaceTensor = tf.image.resizeNearestNeighbor(attackedFaceTensor, [bbox.height, bbox.width]);
        let imageArray = imgTensor.arraySync();
        let resizedAttackedFaceArray = resizedAttackedFaceTensor.arraySync();
        for (let i = 0; i < bbox.height; i++) {
            for (let j = 0; j < bbox.width; j++) {
                for (let k = 0; k < 3; k++) {
                    imageArray[i + bbox.y][j + bbox.x][k] = resizedAttackedFaceArray[i][j][k];
                }
            }
        }
        return tf.tensor(imageArray, undefined, 'int32');
    }
}
