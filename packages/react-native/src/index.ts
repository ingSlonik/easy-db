import AsyncStorage from '@react-native-community/async-storage';

import easyDB, { Data } from "@easy-db/core";

const prefix = "@easy-db:";

export const { insert, select, update, remove } = easyDB({
    async saveCollection(name: string, data: Data) {
        await AsyncStorage.setItem(`${prefix}${name}`, JSON.stringify(data));
    },
    async loadCollection(name: string): Promise<null | Data> {
        const content = await AsyncStorage.getItem(`${prefix}${name}`);
        try {
            const data = JSON.parse(content);
            if (data !== null && typeof data === "object") {
                return data;
            } else {
                return null;
            }
        } catch (e) {
            // TODO: write inconsistent data
            return null;
        }
    },
});
