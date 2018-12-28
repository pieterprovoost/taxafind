let selected

let open = function(e) {
    selected = e.selectionText
    chrome.tabs.create({
        url: chrome.extension.getURL("find.html")
    })
}

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({
        url: chrome.extension.getURL("find.html")
    })
})

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getSelected" && selected) {
        sendResponse({ selected: selected })
    }
    if (request.action === "setSelected") {
        selected = request.selected
    }
})

chrome.contextMenus.create({
    title: "TaxaFind: %s",
    contexts: [ "selection" ],
    onclick: open
})