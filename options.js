document.addEventListener("DOMContentLoaded", restoreOptions);
function restoreOptions() {
    getStorageValue('auto_targeting', _autoTargeting => {
        if(typeof(_autoTargeting) === "undefined"){
            setStorageValue('auto_targeting', true);
            autoTargeting = true;
        }
        else {
            setStorageValue('auto_targeting', _autoTargeting);
            autoTargeting = _autoTargeting;
        }
        displayTargetingDivs();
        document.querySelector("#use_auto_targeting").checked = autoTargeting;
    });
    getStorageValue('target_mode', _targetMode => {
        setStorageValue('target_mode', _targetMode || "both");
        targetMode = _targetMode || "both";
        if(targetMode === 'both') {
            document.querySelector("#use_celebrity_targets").checked = true;
            document.querySelector("#use_custom_targets").checked = true;
        }
        else if(targetMode === 'celebrity'){
            document.querySelector("#use_celebrity_targets").checked = true;
        }
        else if(targetMode === 'custom'){
            document.querySelector("#use_custom_targets").checked = true;
        }
    });
    getStorageValue('target_source', _targetSource => {
        targetSource = _targetSource;
    });
    getStorageValue('target_name', _targetName => {
        targetName = _targetName;
    });
    getStorageValue('custom_victims', victimsDict => {
        victimsDict = victimsDict || {};
        setStorageValue('custom_victims', victimsDict);
        addSelectorOptions('custom_selector', 'custom', victimsDict);
    });
    importCelebritiesVictimsEmbedding().then(victimsDict => {
        addSelectorOptions('celebrity_selector', 'celebrity', victimsDict);
    });
}

let loading = false;
async function saveNewVictim(e) {
    e.preventDefault();
    if(!loading) {
        loading = true;
        document.querySelector("#target_save").innerHTML = 'Saving...';
        document.querySelector("#target_adding_status").innerHTML = '';
        try {
            let name = document.querySelector("#target_name").value,
                imageFiles = document.querySelector("#target_images").files;
            if(name.length === 0){
                document.querySelector("#target_adding_status").innerHTML = 'You should choose a name for your target.';
                document.querySelector("#target_adding_status").style.color = 'red';
            }
            else if(imageFiles.length === 0){
                document.querySelector("#target_adding_status").innerHTML = 'You should select at least one image.';
                document.querySelector("#target_adding_status").style.color = 'red';
            }
            else {
                await detectorInitializer();
                await addTargetVictim(name, imageFiles);
                addNewOptionToSelector("custom_selector", name);
                document.querySelector("#target_name").value = '';
                document.querySelector("#target_images").value = '';
                document.querySelector("#target_adding_status").innerHTML = 'Target `' + name + '` added.';
                document.querySelector("#target_adding_status").style.color = 'green';
            }
        }
        catch (err) {
            document.querySelector("#target_adding_status").innerHTML = 'An error just happened on adding a new target!';
            document.querySelector("#target_adding_status").style.color = 'red';
        }
        loading = false;
        document.querySelector("#target_save").innerHTML = 'Add';
    }
}
document.querySelector("form#adding_target_form").addEventListener("submit", saveNewVictim);

// -----------
let autoTargeting, targetMode, targetSource, targetName;
document.querySelector("#use_auto_targeting").addEventListener("change", function () {
    autoTargeting = this.checked;
    displayTargetingDivs();
});

document.querySelectorAll("#use_celebrity_targets, #use_custom_targets").forEach(item => {
    item.addEventListener("change", function () {
        let celebCheck = document.querySelector("#use_celebrity_targets").checked,
            customCheck = document.querySelector("#use_custom_targets").checked;
        if(celebCheck && celebCheck) targetMode = 'both';
        else if(celebCheck) targetMode = 'celebrity';
        else if(customCheck) targetMode = 'custom';
        else targetMode = undefined;
    });
});

document.getElementById("celebrity_selector").addEventListener("change", function () {
    targetSelected('celebrity', this.value);
});

document.getElementById("custom_selector").addEventListener("change", function () {
    targetSelected('custom', this.value);
});

function displayTargetingDivs(){
    if(autoTargeting){
        document.querySelector("#auto_targeting_is_true").style.display = 'block';
        document.querySelector("#auto_targeting_is_false").style.display = 'none';
    }
    else {
        document.querySelector("#auto_targeting_is_true").style.display = 'none';
        document.querySelector("#auto_targeting_is_false").style.display = 'block';
    }
}

function addSelectorOptions(selectorId, selectorSource, dictionary){
    let sel = document.getElementById(selectorId);
    let opt;
    for(let name in dictionary){
        opt = document.createElement('option');
        opt.appendChild(document.createTextNode(name.split('_').join(' ')));
        opt.value = name;
        if(targetSource === selectorSource && targetName === name) {
            opt.setAttribute('selected', 'true');
            document.getElementById('choosed_target_shower').innerHTML = name;
        }
        sel.appendChild(opt);
    }
}

function addNewOptionToSelector(selectorId, name) {
    let sel = document.getElementById(selectorId);

    let opt = document.createElement('option');
    opt.appendChild(document.createTextNode(name.split('_').join(' ')));
    opt.value = name;
    sel.appendChild(opt);
}

function targetSelected(_targetSource, _targetName) {
    document.getElementById('choosed_target_shower').innerHTML = _targetName;
    targetSource = _targetSource;
    targetName = _targetName;
}

document.querySelector("form#choosing_mode_form").addEventListener("submit", (e) => {
    e.preventDefault();
    if(autoTargeting) {
        if(typeof(targetMode) === 'undefined') {
            document.querySelector("#choosing_target_status").innerHTML = 'You must choose at least one option.';
            document.querySelector("#choosing_target_status").style.color = 'red';
            return;
        }
    }
    else {
        if(typeof(targetSource) === 'undefined' || typeof(targetName) === 'undefined') {
            document.querySelector("#choosing_target_status").innerHTML = 'Please select a victim.';
            document.querySelector("#choosing_target_status").style.color = 'red';
            return;
        }
    }

    setStorageValue('auto_targeting', autoTargeting);
    setStorageValue('target_mode', targetMode);
    setStorageValue('target_source', targetSource);
    setStorageValue('target_name', targetName);
    document.querySelector("#choosing_target_status").innerHTML = 'Saved';
    document.querySelector("#choosing_target_status").style.color = 'green';

});