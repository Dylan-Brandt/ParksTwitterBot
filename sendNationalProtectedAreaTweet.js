import { readFileSync } from 'fs';

import { getTwitterClient, getSpecificPark, getPlacePhotoReferences, getPlaceAerialPhotoBuffer, getManyPlacePhotoBuffers, getSSMParam, putSSMParam } from './lib.js';

export async function sendNationalProtectedAreaTweet(parkType, area = null) {
    const rateLimitReset = await getSSMParam("/everydayparks/rateLimitReset");
    if (rateLimitReset && !(Number(rateLimitReset * 1000) < Date.now())) {
        console.log("rateLimitReset: " + rateLimitReset * 1000);
        console.log("Date.now(): " + Date.now());
        console.log("Skipping tweet as rateLimit not reset");
        return;
    }

    const rwClient = getTwitterClient();

    const data = readFileSync(["./wikipedia_data/national_areas/", parkType.replaceAll(" ", "_").toLowerCase(), "s.json"].join(""));
    const areas_json = JSON.parse(data);
    const keys = Object.keys(areas_json);
    let key = keys[Math.floor(Math.random() * keys.length)];
    console.log(key);
    const wikiData = areas_json[key];
    const wikiChunks = wikiData["Sentence chunks"];

    const googleData = await getSpecificPark(wikiData["Name"] + ` ${parkType}`);
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
    // leadMediaIds.push(await rwClient.v1.uploadMedia(photoBuffers.pop(0), {mimeType: 'image/jpg', chunkLength: 50000}));
    // leadMediaIds.push(await rwClient.v1.uploadMedia(aerialPhotoBuffer, {mimeType: 'image/jpg', chunkLength: 50000}));
    let leadBlurb = `The ${(area ? area : parkType).toLowerCase()} of the week is ` + wikiData["Name"] + ` ${parkType}!\n\n`
        + (googleData["rating"] + "/5 stars (" + googleData["user_ratings_total"] + " ratings)\n\nwiki🧵 below");
    tweets.push({ text: leadBlurb, media: { media_ids: leadMediaIds } });

    let threadMediaIds = [];
    let threadBlurbs = [];
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
        + wikiData["Name"].replaceAll(" ", "_") + "_" + parkType.replaceAll(" ", "_")
        + "\n\n More photos: \n\n"
        + `https://www.google.com/maps/search/?api=1&query=${googleData["geometry"]["location"]["lat"]},${googleData["geometry"]["location"]["lng"]}&query_place_id=${googleData["place_id"]}`;
    let tailMediaIds = [];
    tailMediaIds.push(await rwClient.v1.uploadMedia(aerialPhotoBuffer, { mimeType: 'image/jpg', chunkLength: 50000 }));

    tweets.push({ text: tailBlurb, media: { media_ids: tailMediaIds } });

    console.log(leadBlurb);

    try {
        const result = await rwClient.v2.tweetThread(tweets);
        console.log(result);
    } catch (error) {
        if (error instanceof ApiResponseError) {
            const reset = error.rateLimit?.day?.reset;
            if (reset) {
                await putSSMParam("/everydayparks/rateLimitReset", reset.toString());
            }
        }
    }
}