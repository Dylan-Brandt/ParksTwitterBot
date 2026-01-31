import { readFileSync } from 'fs';

import { getTwitterClient, getSpecificPark, getPlacePhotoReferences, getPlaceAerialPhotoBuffer, getManyPlacePhotoBuffers, getSSMParam, putSSMParam } from './lib.js';

export async function sendNationalHistoricLandmarkTweet(stateFile) {
    const rateLimitReset = await getSSMParam("/everydayparks/rateLimitReset");
    if (rateLimitReset && !(Number(rateLimitReset * 1000) < Date.now())) {
        console.log("rateLimitReset: " + rateLimitReset * 1000);
        console.log("Date.now(): " + Date.now());
        console.log("Skipping tweet as rateLimit not reset");
        return;
    }

    const rwClient = getTwitterClient();

    const data = readFileSync(["./wikipedia_data/national_historic_landmarks/", stateFile].join(""));
    const state_parks = JSON.parse(data);
    const keys = Object.keys(state_parks);

    let wikiChunks = null;
    let key = keys[Math.floor(Math.random() * keys.length)];
    let wikiData;
    while (wikiChunks == null) {
        wikiData = state_parks[key]
        if (Object.hasOwn(wikiData, "Sentence chunks")) {
            wikiChunks = wikiData["Sentence chunks"];
        }
        else {
            key = keys[Math.floor(Math.random() * keys.length)];
        }
    }

    console.log(key);
    console.log(stateFile.replace(".json", ""));
    const googleData = await getSpecificPark(wikiData["Name"]);
    console.log("wiki data: " + wikiData);
    console.log("google data: " + googleData);
    if (googleData.plus_code && googleData.plus_code.compound_code && !googleData.plus_code.compound_code.toLowerCase().includes(stateFile.replace(".json", "").replace("_", " ").toLowerCase())) {
        throw new Error("Google location doesn't match wiki data");
    }
    const photoReferences = await getPlacePhotoReferences(googleData["place_id"]);
    const photoBuffers = await getManyPlacePhotoBuffers(photoReferences);
    const aerialPhotoBuffer = await getPlaceAerialPhotoBuffer("roadmap", 6, googleData["geometry"]["location"]["lat"], googleData["geometry"]["location"]["lng"], true);

    let tweets = [];

    let leadMediaIds = [];
    if (photoBuffers.length < 4) {
        for (let i = 0; i < photoBuffers.length; i++) {
            leadMediaIds.push(await rwClient.v1.uploadMedia(photoBuffers.pop(i), { mimeType: 'image/jpg', chunkLength: 50000 }));
        }
    }
    else {
        for (let i = 0; i < 3; i++) {
            leadMediaIds.push(await rwClient.v1.uploadMedia(photoBuffers.pop(i), { mimeType: 'image/jpg', chunkLength: 50000 }));
        }
    }
    // leadMediaIds.push(await rwClient.v1.uploadMedia(aerialPhotoBuffer, {mimeType: 'image/jpg', chunkLength: 50000}));
    let leadBlurb = 'Today\'s national historic landmark highlight is ' + wikiData["Name"] + `, located in ${stateFile.replaceAll("_", " ").replace(".json", "")}.\n\n`
        + (googleData["rating"] + "/5 stars (" + googleData["user_ratings_total"] + " ratings)\n\nwiki 🧵 below");
    tweets.push({ text: leadBlurb, media: { media_ids: leadMediaIds } });

    let threadMediaIds = [];
    for (let i = 0; i < photoBuffers.length; i++) {
        threadMediaIds.push([await rwClient.v1.uploadMedia(photoBuffers[i], { mimeType: 'image/jpg', chunkLength: 50000 })]);
    }

    let numThreadTweets = wikiChunks.length < 7 ? wikiChunks.length : 7;

    for (let i = 0; i < numThreadTweets; i++) {
        if (i < threadMediaIds.length) {
            tweets.push({ text: wikiChunks[i], media: { media_ids: threadMediaIds[i] } });
        }
        else {
            tweets.push(wikiChunks[i]);
        }
    }

    let tailBlurb = "Read more:\n\n" + "https://en.wikipedia.org/wiki/"
        + wikiData["Name"].replaceAll(" ", "_")
        + "\n\nMore photos: \n\n"
        + `https://www.google.com/maps/search/?api=1&query=${googleData["geometry"]["location"]["lat"]},${googleData["geometry"]["location"]["lng"]}&query_place_id=${googleData["place_id"]}`
    let tailMediaIds = [];
    tailMediaIds.push(await rwClient.v1.uploadMedia(aerialPhotoBuffer, { mimeType: 'image/jpg', chunkLength: 50000 }));
    tweets.push({ text: tailBlurb, media: { media_ids: tailMediaIds } });

    console.log(leadBlurb);

    try {
        const result = await rwClient.v2.tweetThread(tweets);
        console.log(result)
    } catch (error) {
        if (error instanceof ApiResponseError) {
            const reset = error.rateLimit?.day?.reset;
            if (reset) {
                await putSSMParam("/everydayparks/rateLimitReset", reset.toString());
            }
        }
    }
}