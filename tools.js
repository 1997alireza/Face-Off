function getBrowserType() { // TODO: more browsers? // TODO: handle it by splitted codes for each browser
    if (typeof InstallTrigger !== 'undefined') return 'firefox'; // Firefox 1.0+
    else if (!!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)) return 'chrome'; // Chrome 1 - 71
    throw new Error('Undefined browser!');
}

// function getBrowserObject() {
//     switch (getBrowserType()) {
//         case 'firefox':
//             return browser;
//         case 'chrome':
//             return chrome;
//     }
// }

/**
 *
 * @param mode can be chosen from ['celebrity', 'custom', 'both']
 */
function importVictimsEmbedding(mode='celebrity') {
    return new Promise(async resolve => {
        switch(mode){
            case 'celebrity':
                resolve(await importCelebritiesVictimsEmbedding());
                break;
            case 'custom':
                getStorageValue('custom_victims', (victimsDict) => {
                    resolve(victimsDict);
                });
                break;
            default:
                getStorageValue('custom_victims', async (victimsDict) => {
                    let celebritiesVictimsEmbedding = await importCelebritiesVictimsEmbedding();
                    for(let name in victimsDict){
                        celebritiesVictimsEmbedding[name] = victimsDict[name];
                    }
                    resolve(celebritiesVictimsEmbedding);
                });
        }
    });
}

function importCelebritiesVictimsEmbedding(data = 'datasets/victims.json') {
    return new Promise((resolve, reject) => {
        const url = getUrlOfData(data);
        fetch(url)
            .then((response) => response.json())
            .then((json) => {
                resolve(json);
            })
            .catch((err) => {
                reject(err);
            });

    });
}

function getUrlOfData(localAddress) {
    // switch(getBrowserType()) {
    //     case 'firefox':
    //         return browser.runtime.getURL(localAddress);
    //     case 'chrome':
    //         return chrome.runtime.getURL(localAddress);
    // }
    return chrome.runtime.getURL(localAddress); // both of chrome and firefox know the chrome object
}

function getStorageValue(key, callback){
    switch(getBrowserType()){
        case 'firefox':
            browser.storage.local.get(key).then(result => callback(result[key]), error => console.log(`Error on getting storage value: ${error}`));
            break;
        case 'chrome':
            chrome.storage.local.get([key], result => callback(result[key]));
            break;
    }
}

function setStorageValue(key, value){
    switch(getBrowserType()){
        case 'firefox':
            browser.storage.local.set({[key]: value});
            break;
        case 'chrome':
            chrome.storage.local.set({[key]: value});
            break;
    }
}

function matrixMultiply(a, b) {
    let aNumRows = a.length, aNumCols = a[0].length,
        bNumRows = b.length, bNumCols = b[0].length,
        m = new Array(aNumRows);  // initialize array of rows

    assert(aNumCols === bNumRows, 'can not multiply these matrices');
    for (let r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols); // initialize the current row
        for (let c = 0; c < bNumCols; ++c) {
            m[r][c] = 0;             // initialize the current cell
            for (let i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }
    return m;
}

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}
