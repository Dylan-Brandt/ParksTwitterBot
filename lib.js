import { TwitterApi } from 'twitter-api-v2';
import { SSMClient, PutParameterCommand, GetParameterCommand } from "@aws-sdk/client-ssm";
import fetch from "node-fetch";

import * as keys from './keys/key.js';

export const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Puerto Rico', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

async function getCities(state) {
    try {
        let url = "https://countriesnow.space/api/v0.1/countries/state/cities/q?country=United%20States&state=" + state;
        let response = await fetch(url, { method: "GET" });
        let retVal = state;
        if (response.ok) {
            let responseJSON = await response.json();
            if (responseJSON["data"].length > 0) {
                retVal = responseJSON["data"]
            }
        }
        return retVal;
    }
    catch (error) {
        console.error(error);
    }
}

export function getRandomState() {
    let randomStateIndex = Math.floor(Math.random() * STATES.length);
    return STATES[randomStateIndex];
}

export async function getRandomCity(stateParam = undefined) {
    let state;
    if (stateParam) {
        state = stateParam;
    }
    else {
        state = getRandomState();
    }
    let cities = await getCities(state);
    if (Array.isArray(cities)) {
        return cities[Math.floor(Math.random() * cities.length)];
    }
    else {
        throw new Error("Unable to get random city for " + stateParam);
    }
}

export async function getRandomPark(city, state) {
    let url = "https://maps.googleapis.com/maps/api/place/textsearch/json?key=" + keys.googleAPIKey
        + "&query=" + city + ", " + state
        + "&type=park";
    let response = await fetch(url, { method: "GET" });
    if (response.ok) {
        let parksJSON = await response.json();
        let park;
        if (parksJSON["status"] == "ZERO_RESULTS") {
            throw new ReferenceError("No results for place query at " + city + ", " + state);
        }
        do {
            park = parksJSON["results"][Math.floor(Math.random() * parksJSON["results"].length)];
        } while (!park["photos"]);
        return park;
    }
    else {
        throw new URIError("Could not receive place data!");
    }
}

export async function getSpecificPark(query) {
    let url = "https://maps.googleapis.com/maps/api/place/textsearch/json?key=" + keys.googleAPIKey
        + "&query=" + query;

    let response = await fetch(url, { method: "GET" });
    if (response.ok) {
        let parksJSON = await response.json();
        let park;
        if (parksJSON["status"] == "ZERO_RESULTS") {
            throw new ReferenceError("No results for place query " + query);
        }
        do {
            park = parksJSON["results"][Math.floor(Math.random() * parksJSON["results"].length)];
        } while (!park["photos"]);
        return park;
    }
    else {
        throw new URIError("Could not receive place data!");
    }
}

export async function getPlacePhotoReferences(place_id) {
    try {
        let url = "https://maps.googleapis.com/maps/api/place/details/json"
            + "?key=" + keys.googleAPIKey
            + "&place_id=" + place_id
            + "&fields=photos";
        let response = await fetch(url, { method: "GET" });
        if (response.ok) {
            let responseJSON = await response.json();
            return responseJSON["result"]["photos"];
        }
        else {
            throw new Error("Could not receive photo references!");
        }
    }
    catch (error) {
        console.error(error);
    }
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array/12646864#12646864
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

// Get four or less random photos from the references
export async function getPlacePhotoBuffers(photo_references) {
    let randomIndexes = [];
    let numPhotosToFetch;
    let buffers = [];
    for (let i = 0; i < photo_references.length; i++) {
        randomIndexes.push(i);
    }
    shuffleArray(randomIndexes);
    if (randomIndexes.length > 3) {
        numPhotosToFetch = 3;
    }
    else {
        numPhotosToFetch = randomIndexes.length;
    }

    for (let i = 0; i < numPhotosToFetch; i++) {
        try {
            let url = "https://maps.googleapis.com/maps/api/place/photo?key="
                + keys.googleAPIKey
                + "&photo_reference=" + photo_references[randomIndexes[i]]["photo_reference"]
                + "&maxwidth=1600";
            let response = await fetch(url, { method: "GET", accept: "image/*" });
            if (response.ok) {
                let responseBlob = await response.blob();
                let responseArrayBuffer = await responseBlob.arrayBuffer();
                let responseBuffer = Buffer.from(responseArrayBuffer, 'binary');
                buffers.push(responseBuffer);
            }
            else {
                throw new Error("Could not receive place photo!");
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    return buffers;
}

export async function getManyPlacePhotoBuffers(photo_references) {
    let randomIndexes = [];
    let numPhotosToFetch;
    let buffers = [];
    for (let i = 0; i < photo_references.length; i++) {
        randomIndexes.push(i);
    }
    shuffleArray(randomIndexes);
    numPhotosToFetch = randomIndexes.length;

    for (let i = 0; i < numPhotosToFetch; i++) {
        try {
            let url = "https://maps.googleapis.com/maps/api/place/photo?key="
                + keys.googleAPIKey
                + "&photo_reference=" + photo_references[randomIndexes[i]]["photo_reference"]
                + "&maxwidth=1600";
            let response = await fetch(url, { method: "GET", accept: "image/*" });
            if (response.ok) {
                let responseBlob = await response.blob();
                let responseArrayBuffer = await responseBlob.arrayBuffer();
                let responseBuffer = Buffer.from(responseArrayBuffer, 'binary');
                buffers.push(responseBuffer);
            }
            else {
                throw new Error("Could not receive place photo!");
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    return buffers;
}

export async function getPlaceAerialPhotoBuffer(maptype, zoom, lat, lng, markers = false) {
    try {
        let coordinates = lat + "," + lng;
        let url = "https://maps.googleapis.com/maps/api/staticmap?key="
            + keys.googleAPIKey
            + "&center=" + coordinates
            + "&size=500x400"
            + "&maptype=" + maptype
            + "&zoom=" + zoom + "&scale=2";
        if (markers) {
            url = url + "&markers=size:small|" + coordinates;
        }
        let response = await fetch(url, { method: "GET", accept: "image/*" });
        if (response.ok) {
            let responseBlob = await response.blob();
            let responseArrayBuffer = await responseBlob.arrayBuffer();
            let responseBuffer = Buffer.from(responseArrayBuffer, 'binary');
            return responseBuffer;
        }
        else {
            throw new Error("Could not receive place photo!");
        }
    }
    catch (error) {
        console.error(error);
    }
}

export async function getPlaceShareLink(lat, lng, place_id) {
    let url = "https://www.google.com/maps/search/?api=1&query="
        + lat + "," + lng
        + "&query_place_id=" + place_id;

    let response = await fetch(url, { method: "GET" });
    console.log(response);
}

export function getTwitterClient() {
    const userClient = new TwitterApi({
        appKey: keys.consumerKey,
        appSecret: keys.consumerSecret,
        accessToken: keys.accessToken,
        accessSecret: keys.accessSecret,
    });

    return userClient.readWrite;
}

export async function putSSMParam(parameterName, parameterValue) {
    const client = new SSMClient({ region: "us-east-1" });
    const input = {
        Name: parameterName,
        Value: parameterValue,
        Type: "String",
        Overwrite: true
    };

    const command = new PutParameterCommand(input);
    try {
        const data = await client.send(command);
        console.log("Parameter put successfully. Version:", data.Version);
    } catch (err) {
        console.error("Error putting parameter:", err);
    }
}

export async function getSSMParam(parameterName) {
    const client = new SSMClient({ region: "us-east-1" });
    const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: false,
    });

    try {
        const data = await client.send(command);
        if (data.Parameter && data.Parameter.Value) {
            return data.Parameter.Value;
        } else {
            throw new Error(`Parameter ${parameterName} not found or is empty.`);
        }
    } catch (err) {
        console.error("Error retrieving SSM parameter:", err);
        return undefined;
    }
}