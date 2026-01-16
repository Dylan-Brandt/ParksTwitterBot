
import { getTwitterClient, getRandomState, getRandomCity, getRandomPark, getPlacePhotoReferences, getPlacePhotoBuffers, getPlaceAerialPhotoBuffer, isRateLimitExceeded } from './index.js';

export async function sendRandomParkTweet() {
    const rwClient = getTwitterClient();

    if(await isRateLimitExceeded(rwClient)) {
        console.log("Skipping tweet as rate limit is exceeded");
        return;
    }

    let state = getRandomState();
    let city =  await getRandomCity(state);
    let park = await getRandomPark(city, state);
    let parkPhotoReferences = await getPlacePhotoReferences(park["place_id"]);
    let parkPhotoBuffers = await getPlacePhotoBuffers(parkPhotoReferences);
    let aerialPhotoBuffer = await getPlaceAerialPhotoBuffer("roadmap", 6, park["geometry"]["location"]["lat"], park["geometry"]["location"]["lng"], true);

    // Upload photos
    let mediaIds = [];
    for(let i = 0; i < parkPhotoBuffers.length; i++) {
        mediaIds.push(await rwClient.v1.uploadMedia(parkPhotoBuffers[i], {mimeType: 'image/jpg', chunkLength: 50000}));
    }
    mediaIds.push(await rwClient.v1.uploadMedia(aerialPhotoBuffer, {mimeType: 'image/jpg', chunkLength: 50000}));

    let cityState = city + ", " + state;
    let blurb = park["name"] + "\n"
        + cityState + "\n"
        + (park["rating"] + "/5 stars (" + park["user_ratings_total"] + " ratings)\n")
        + `https://www.google.com/maps/search/?api=1&query=${park["geometry"]["location"]["lat"]},${park["geometry"]["location"]["lng"]}&query_place_id=${park["place_id"]}`;

    const result = await rwClient.v2.tweet(blurb, {media: {media_ids: mediaIds}});
    console.log(result);
}