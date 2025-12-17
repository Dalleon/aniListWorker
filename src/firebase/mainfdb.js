const { getFirestore, getApp } = require('./firebaseUtils');
const app = getApp(process.env.firedb, "default");
const firestore = getFirestore(app);

const collection = firestore.collection("def"); 
const docRef = collection.doc("anime")

async function upload(data) {
  try {
    await docRef.set(data);
    console.log("set date...")
  } catch (err) {
    console.error('Error setting document:', err);
    throw err;
  }
}

module.exports = {
    upload
}