let initialized = false;
async function detectorInitializer() {
    if(!initialized) {
        initialized = true;
        switch(getBrowserType()){
            case 'chrome':
                try {
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(getUrlOfData('models/faceapi-ssdMobilenetV1-weights')); // works in facebook page
                } catch (e) {
                    try {
                        await faceapi.nets.ssdMobilenetv1.loadFromUri('models/faceapi-ssdMobilenetV1-weights'); // works in plugin's option page
                    } catch (e) {
                        await faceapi.nets.ssdMobilenetv1.loadFromUri('https://github.com/justadudewhohacks/face-api.js/raw/master/weights');
                    }
                }
                break;
            case 'firefox':
                await faceapi.nets.ssdMobilenetv1.loadFromUri('https://github.com/justadudewhohacks/face-api.js/raw/master/weights');
                break;
        }
    }
}

function faceDetector(imageObject, squareFaceBox = false, displayFaces = false) {
    return new Promise(async resolve => {
        const detections = await faceapi.detectAllFaces(imageObject, new faceapi.SsdMobilenetv1Options());
        console.log("Detections Num:", detections.length);
        let detectedFaces = [];
        let promises = [];
        detections.forEach(
            function (detectedFace) {
                let faceBox = detectedFace.box;
                let cropFunctionResult = cropImage(imageObject, faceBox.x, faceBox.y, faceBox.width, faceBox.height, 0, true, true); // we need square images to use tensorflow resizing options
                let faceImageObject = cropFunctionResult[0];
                let croppedFaceBox = {
                    x: cropFunctionResult[1],
                    y: cropFunctionResult[2],
                    width: cropFunctionResult[3],
                    height: cropFunctionResult[4]
                };
                promises.push(resizeImage(faceImageObject, 160, 160));
                detectedFaces.push({'scaled': undefined, 'box': croppedFaceBox, 'prob': detectedFace.score});
            }
        );
        Promise.all(promises)
            .then((items) => {
                // console.log("Items:", items[0]);
                for (let i = 0; i < items.length; i++) {

                    detectedFaces[i]['scaled'] = items[i]
                }
                // console.log("items:", items);
                // console.log("detectedFaces Num:", detectedFaces.length);
                detectedFaces.sort(function (a, b) {
                    return b.prob - a.prob
                });
                // console.log("detectedFaces Num:", detectedFaces.length);
                if (displayFaces) { // TODO: remove on product version
                    detectedFaces.forEach(function (detectedFace) {
                        displayImage(detectedFace.scaled);
                    });
                }
                resolve(detectedFaces);
            });
    });
}
