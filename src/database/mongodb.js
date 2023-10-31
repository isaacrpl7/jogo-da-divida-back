const { MongoClient } = require('mongodb')

class MongoDBConnection {
    getConnection() {
        return this.client;
    }
    async connectToCluster(uri) {
        let mongoClient;
    
        try {
            mongoClient = new MongoClient(uri);
            console.log('Connecting to MongoDB Atlas cluster...');
            await mongoClient.connect();
            console.log('Successfully connected to MongoDB Atlas!');
    
            this.client = mongoClient;
        } catch (error) {
            console.error('Connection to MongoDB Atlas failed!', error);
            process.exit();
        }
    }
}

module.exports = {MongoDBConnection}