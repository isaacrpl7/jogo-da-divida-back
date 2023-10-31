const { v4: uuidv4 } = require('uuid');

class UserController {
    constructor(connection) {
        this.connection = connection
    }
    
    async createUser({ name, ws }){
        const db = this.connection.db('sessions');
        const collection = db.collection('users');
        const studentDocument = {
            name,
            connected: true,
            token: uuidv4(),
            room: null,
            ws
        };
        await collection.insertOne(studentDocument)
        return studentDocument.token
    }

    async disconnectUser({ token }) {
        const db = this.connection.db('sessions');
        const collection = db.collection('users');
        await collection.findOneAndUpdate({token}, {$set: {connected: false}})
    }

    async removeUser({ token }) {
        const db = this.connection.db('sessions');
        const collection = db.collection('users');
        await collection.deleteOne({token})
    }
}

module.exports = {UserController}