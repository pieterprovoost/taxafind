$("#form").submit(function(event) {
    search()
    event.preventDefault()
})

chrome.runtime.sendMessage({ action: "getSelected" }, function(response) {
    if (response.selected) {
        $("#search").val(response.selected)
        search()
    }
})

const add = function(taxa) {
    taxa.forEach(function(data) {
        let html
        if (data.nameUsage) {
            html = `  
            <tr>
                <td>${data.provider}</td>
                <td>
                    <a href="${data.link}" target="_blank">${data.acceptedNameUsage}</a>
                    <br/><span class="smaller">Accepted name for <a href="${data.unacceptedLink}" target="_blank">${data.nameUsage}</a></span>
                </td>
                <td>${data.acceptedNameUsageID}</td>
                <td>${data.records ? data.records : ""}</td>
            </tr>
            `
        } else {
            html = `  
            <tr>
                <td>${data.provider}</td>
                <td>
                    <a href="${data.link}" target="_blank">${data.acceptedNameUsage}</a>
                </td>
                <td>${data.acceptedNameUsageID}</td>
                <td>${data.records ? data.records : ""}</td>
            </tr>
            `
        }
        $("#results tbody").append(html)
    })
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1)
}

const search = function() {
    let name = $("#search").val().trim()
    chrome.runtime.sendMessage({
        action: "setSelected",
        selected: name
    })
    $("#results tbody").empty()
    gbif(name).then(add)
    obis(name).then(add)
    worms(name).then(add)
    inaturalist(name).then(add)
    eol(name).then(add)
}

const gbif = async function(name) {
    let res = await $.get("http://api.gbif.org/v1/species/match?verbose=true&strict=true&name=" + name.capitalize())
    let taxa = []
    if (res && (res.usageKey || res.acceptedUsageKey)) {
        taxa = [ res ]
    } else if (res.alternatives) {
        taxa = res.alternatives
    }
    let p = taxa.map(async function(taxon) {
        let result = {
            provider: "GBIF"
        }
        if (taxon != null && (taxon.usageKey || taxon.acceptedUsageKey)) {
            if (taxon.acceptedUsageKey) {
                accepted = await $.get("http://api.gbif.org/v1/species/" + taxon.acceptedUsageKey)
                result.acceptedNameUsage = accepted.scientificName
                result.acceptedNameUsageID = accepted.key
                result.link = "https://www.gbif.org/species/" + accepted.key
                unaccepted = await $.get("http://api.gbif.org/v1/species/" + taxon.usageKey)
                result.nameUsage = unaccepted.scientificName
                result.nameUsageID = unaccepted.key
                result.unacceptedLink = "https://www.gbif.org/species/" + unaccepted.key
            } else {
                result.acceptedNameUsageID = taxon.acceptedUsageKey ? taxon.acceptedUsageKey : taxon.usageKey
                result.link = "https://www.gbif.org/species/" + result.acceptedNameUsageID
                result.acceptedNameUsage = taxon.scientificName
            }
            let stats = await $.get("http://api.gbif.org/v1/occurrence/search?limit=0&taxonKey=" + result.acceptedNameUsageID)
            if (stats != null && stats.count) {
                result.records = stats.count
            }
        }
        return result
    })
    return Promise.all(p)
}

const obis = async function(name) {
    let results = []
    let res = await $.get("http://api.obis.org/v3/taxon/" + name)
    if (res != null && res.results && res.results.length >= 1) {
        let result = {
            provider: "OBIS"
        }
        let taxon = res.results[0]
        result.acceptedNameUsage = taxon.acceptedNameUsage
        result.acceptedNameUsageID = taxon.acceptedNameUsageID
        result.link = "https://test.obis.org/taxon/" + taxon.acceptedNameUsageID
        if (taxon.acceptedNameUsageID != taxon.taxonID) {
            result.nameUsage = taxon.scientificName
            result.unacceptedLink = "https://test.obis.org/taxon/" + taxon.taxonID
        }
        let stats = await $.get("http://api.obis.org/v3/statistics?taxonid=" + taxon.acceptedNameUsageID)
        if (stats != null && stats.records) {
            result.records = stats.records
        }
        results.push(result)
    }
    return results
}

const inaturalist = async function(name) {
    let results = []
    let res = await $.get("https://api.inaturalist.org/v1/taxa?q=" + name)
    if (res != null && res.results && res.results.length >= 1) {
        let result = {
            provider: "iNaturalist"
        }
        let taxon = res.results[0]
        result.acceptedNameUsage = taxon.name
        result.acceptedNameUsageID = taxon.id
        result.link = "https://www.inaturalist.org/taxa/" + taxon.id
        result.records = taxon.observations_count
        results.push(result)
    }
    return results
}

const eol = async function(name) {
    let results = []
    let res = await $.get("https://eol.org/api/search/1.0.json?q=" + name)
    if (res != null && res.results && res.results.length >= 1) {
        let result = {
            provider: "EOL"
        }
        let taxon = res.results[0]
        result.acceptedNameUsage = taxon.title
        result.acceptedNameUsageID = taxon.id
        result.link = "https://eol.org/pages/" + taxon.id
        results.push(result)
    }
    return results
}

const worms = async function(name) {
    let results = []
    let res = await $.get("http://www.marinespecies.org/rest/AphiaRecordsByName/" + name + "?like=false&marine_only=false")
    res.filter(x => x.status != "deleted").forEach(function(taxon) {
        let result = {
            provider: "WoRMS"
        }
        result.acceptedNameUsage = taxon.valid_name
        result.acceptedNameUsageID = taxon.valid_AphiaID
        result.link = "http://www.marinespecies.org/aphia.php?p=taxdetails&id=" + taxon.valid_AphiaID
        if (taxon.status != "accepted") {
            result.nameUsage = taxon.scientificname
            result.nameUsageID = taxon.AphiaID
            result.unacceptedLink = "http://www.marinespecies.org/aphia.php?p=taxdetails&id=" + taxon.AphiaID
        }
        results.push(result)
    })
    return results
}