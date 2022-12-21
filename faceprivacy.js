// TODO: delete comments and unimportant logs on product version, --minify-- the plugin on product version

var perturbImageFile = null;

function isImageFile(file) {
    var ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
    return ext == "png" || ext == "jpeg" || ext == "jpg";
}

async function getModifiedFileList(node) {
    var list = new DataTransfer();

    for (var file of node.files) {
        if (!isImageFile(file)) {
            list.items.add(file);
            continue;
        }
        // saveAs(file);

        // exit

        var perturbedImg = null;
        try {
            perturbedImg = await perturbImageFile(file);
        } catch (e) {
            console.error(e);
            perturbedImg = file;
        }
        list.items.add(perturbedImg);
    }
    // console.log("Modified list is complete!");
    return list.files;
}

function clip(v) {
    return v > 255 ? 255 : v < 0 ? 0 : v;
}

// function applyPerturbation(image, perturbation, box) {
//     var box_x = Math.floor(box.x);
//     var box_y = Math.floor(box.y);
//     var box_width = Math.ceil(box.width);
//     var box_height = Math.ceil(box.height);
//     return new Promise((resolve, reject) => {
//         image.scan(box_x, box_y, box_width, box_height, function (x, y, idx) {
//             var r = idx;
//             var g = idx + 1;
//             var b = idx + 2;
//             var a = idx + 3;
//
//             var rel_x = x - box_x;
//             var rel_y = y - box_y;
//
//             // rgba values run from 0 - 255
//             this.bitmap.data[r] = clip(this.bitmap.data[r] + perturbation.getDelta(rel_y, rel_x, 0));
//             this.bitmap.data[g] = clip(this.bitmap.data[g] + perturbation.getDelta(rel_y, rel_x, 1));
//             this.bitmap.data[b] = clip(this.bitmap.data[b] + perturbation.getDelta(rel_y, rel_x, 2));
//
//             if (rel_x == box_width - 1 && rel_y == box_height - 1) {
//                 // image scan finished
//                 resolve();
//             }
//         });
//     });
// }
//
// async function detectFaces(dataUrl) {
//     var img_obj = new Image();
//     img_obj.crossOrigin = "anonymous";
//     img_obj.src = dataUrl;
//     return await faceapi.detectAllFaces(img_obj, new faceapi.SsdMobilenetv1Options());
// }

// async function noPerturbation(file) {
//     var dataUrl = await fileToDataUrl(file);
//
//     var image = await Jimp.read(dataUrl);
//     var mime = image.getMIME();
//
//     var dataArray = await image.getBufferAsync(mime);
//     return new File([dataArray], file.name, {
//         type: mime,
//     });
// }

async function runReportGenerator(file) {
    var dataUrl = await fileToDataUrl(file);
    var image = await Jimp.read(dataUrl);

    // let bitmap3ChannelArray = undefined;
    // if (fixOrientation) {
    //     let fixedOrientationImageObject = await getCorrectedImageOrientation(file,
    //         await getImageOrientation(file));
    //     fixedOrientationImageObject.crossOrigin = "anonymous";
    //
    //     bitmap3ChannelArray = await attackAutoTargeting(fixedOrientationImageObject);
    //     image.bitmap.width = fixedOrientationImageObject.width;
    //     image.bitmap.height = fixedOrientationImageObject.height;
    // }
    // else {
    // let dataClampedArray = new Uint8ClampedArray(image.bitmap.data);
    // let imageData = new ImageData(dataClampedArray, width, height);
    // let imageObject = imageDataToImageObject(imageData);  // it's working on chrome but not firefox

    let name = file.name.split('.').slice(0, -1).join('.');
    await performTest(image, file, name);

    return file;
}

async function impersonatorPerturbation(file) {
    var dataUrl = await fileToDataUrl(file);
    var image = await Jimp.read(dataUrl);

    let imageObject = await imageObjectExtractorOrienFixing(file);
    image.bitmap.width = imageObject.width;
    image.bitmap.height = imageObject.height; // fixing orientation may affect on dimensions

    let eps = 14; // TODO: should be taken from options

    let targetOption;
    if(!autoTargeting && (!targetSource || !targetName)){
        autoTargeting = true;
    }
    if(autoTargeting) {
        targetOption = targetMode;
    }
    else {
        targetOption = [targetSource, targetName];
    }
    let bitmap3ChannelArray = await attackOnTarget(imageObject, eps, autoTargeting, targetOption);

    for (let i = 0; i < bitmap3ChannelArray.length / 3; i++) { // i: index of each pixel
        image.bitmap.data[4 * i] = bitmap3ChannelArray[3 * i];
        image.bitmap.data[4 * i + 1] = bitmap3ChannelArray[3 * i + 1];
        image.bitmap.data[4 * i + 2] = bitmap3ChannelArray[3 * i + 2];
        // and we don't edit the alpha (image.bitmap.data[4*i + 3])
    }

    var mime = image.getMIME();
    let dataArray = await image.getBufferAsync(mime);
    return new File([dataArray], file.name, {type: mime,});
}

// async function dummyPerturbation(file) {
//     var dataUrl = await fileToDataUrl(file);
//     var image = await Jimp.read(dataUrl);
//
//     for (let i = 0; i < image.bitmap.data.length; i++) {
//         image.bitmap.data[i] = Math.abs(Math.random() * 40)
//     }
//
//     var mime = image.getMIME();
//     let dataArray = await image.getBufferAsync(mime);
//     return new File([dataArray], file.name, {type: mime,});
// }

// async function fixedNoisePerturbation(file) {
//     var dataUrl = await fileToDataUrl(file);
//
//     var faces = await detectFaces(dataUrl);
//     var image = await Jimp.read(dataUrl);
//     var mime = image.getMIME();
//
//     // fetch perturbations for each face box
//     var perturbations = faces.map((face) => {
//         return new Promise(async (resolve, reject) => {
//             var p = await fetchPerturbation(Math.ceil(face.box.height), Math.ceil(face.box.width));
//             resolve([face.box, p]);
//         });
//     });
//
//     // await all perturbations, then apply sequentially
//     await Promise.all(perturbations).then(async (completed) => {
//         var seq = Promise.resolve();
//         for (const [box, p] of completed) {
//             seq = seq.then(async () => {
//                 await applyPerturbation(image, p, box)
//             });
//         }
//         await seq;
//     });
//
//     var dataArray = await image.getBufferAsync(mime);
//     return new File([dataArray], file.name, {
//         type: mime,
//     });
// }

// function onError(error) {
//     console.log(`Error: ${error}`);
// }



function setPerturbationAlgorithm() {
    // perturbImageFile = impersonatorPerturbation;
    perturbImageFile = runReportGenerator; // to generate the latex report

    //
    // let algo = "impersonator";
    // if (item && typeof item === 'string' && item.length > 0) {
    //     algo = item;
    // }
    // switch (algo) {
    //     case "none":
    //         perturbImageFile = noPerturbation;
    //         break;
    //     case "impersonator":
    //         perturbImageFile = impersonatorPerturbation;
    //         break;
    // }
    console.log("Face privacy plugin loaded");
}

setPerturbationAlgorithm();

getStorageValue('custom_victims', victimsDict => {
    setStorageValue('custom_victims', victimsDict || {});
});

let autoTargeting, targetMode, targetSource, targetName;
getStorageValue('auto_targeting', _autoTargeting => { // TODO: should program wait for the storage stuffs?
    if(typeof(_autoTargeting) === "undefined"){
        autoTargeting = true;
    }
    else {
        autoTargeting = _autoTargeting;
    }
    setStorageValue('auto_targeting', autoTargeting);
});
getStorageValue('target_mode', _targetMode => {
    setStorageValue('target_mode', _targetMode || "both");
    targetMode = _targetMode || "both";
});
getStorageValue('target_source', _targetSource => {
    targetSource = _targetSource;
});
getStorageValue('target_name', _targetName => {
    targetName = _targetName;
});


$.initialize('._3jk', async function () {
        var isDone = false;
        this.addEventListener("change", async function (event) {
            if (isDone === true) {
                isDone = false;
                return;
            }
            event.stopImmediatePropagation();
            await detectorInitializer();
            for (let i in this.childNodes) {
                let node = this.childNodes[i];
                if (node.nodeType === Node.ELEMENT_NODE) {
                    event.target.files = await getModifiedFileList(node);
                    // Retrigger event
                    isDone = true;
                    node.dispatchEvent(event);
                    return;
                }
            }
        }, true);
    }
);
