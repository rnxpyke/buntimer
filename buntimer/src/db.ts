import { Database } from "bun:sqlite";
import { Entry } from "./views";
import assert from "assert";

function convertEntry(raw: any): Entry {
    const id = raw.id;
    assert.equal(typeof id, 'string', 'id not a string');
    const description = raw.description;
    assert.equal(typeof description, 'string', 'description not a string');
    const startMillis = Date.parse(raw.start);
    const stopMillis = Date.parse(raw.stop);
    assert.equal(typeof startMillis, 'number', 'start not a valid timestamp');
    assert.equal(typeof stopMillis, 'number', 'stop not a valid timestamp');
    const start = new Date(startMillis);
    const stop = new Date(stopMillis);

    return { id, description, start, stop };
}

class DB extends Database {
    constructor(...args: any[]) {
        super(...args)
    }

    setup() {
        this.run(`
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            description TEXT,
            start TEXT, stop TEXT
        )`);
        return this;
    }

    insertEntry(userId: string, entry: Entry) {
        this.run("INSERT INTO events (id, user_id, description, start, stop) VALUES (?, ?, ?, ?, ?)", [
            entry.id,
            userId,
            entry.description,
            entry.start.toISOString(),
            entry.stop.toISOString()
        ]);
    }

    findEntry(userId: string, id: string): Entry|undefined {
        const result = this.query("SELECT * FROM events WHERE id = $id AND user_id = $user_id").get({ $id: id, $user_id: userId });
        if (result) {
            return convertEntry(result);
        }
        return undefined;
    } 

    queryEntries(userId: string): Entry[] {
        const rawEntries = this.query("SELECT * FROM events WHERE user_id = $user_id").all({ $user_id: userId });
        const entries = [];
        for (let raw of rawEntries) {
            try {
                const entry = convertEntry(raw);
                entries.push(entry);
            } catch (e) {
                console.error(e);
            }
        }
        return entries;
    }
}

export { DB };