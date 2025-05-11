const admin = require('firebase-admin');
//const serviceAccount = require('../firebaseServiceAccount.json');

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    };

    // Validate required fields
    if (!privateKey || !serviceAccount.project_id || !serviceAccount.client_email) {
      throw new Error('Missing required Firebase configuration. Please check your environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin;
};


module.exports = {
  admin: initializeFirebaseAdmin(),
  sendNotification: async (token, title, body, data = {}) => {
    try {
      const messaging = initializeFirebaseAdmin().messaging();
      
      const message = {
        notification: {
          title,
          body,
        },
        data,
        token,
      };

      const response = await messaging.send(message);
      return { success: true, response };
    } catch (error) {
      console.error('Error sending Firebase notification:', error);
      return { success: false, error: error.message };
    }
  },
  sendMultipleNotifications: async (tokens, title, body, data = {}) => {
    try {
      const messaging = initializeFirebaseAdmin().messaging();
      
      const message = {
        notification: {
          title,
          body,
        },
        data,
        tokens,
      };

      const response = await messaging.sendMulticast(message);
      return { 
        success: true, 
        response,
        successCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (error) {
      console.error('Error sending multiple Firebase notifications:', error);
      return { success: false, error: error.message };
    }
  }
};