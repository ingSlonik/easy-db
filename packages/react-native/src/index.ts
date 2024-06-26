import AsyncStorage from "@react-native-async-storage/async-storage";

import easyDB, { Data, DBTypes } from "easy-db-core";

const prefix = "@easy-db:";

export default function easyDBReactNative<T extends DBTypes>(conf?: {}) {
    return easyDB<T>({
        async saveCollection(name: string, data: Data) {
            // v2 await AsyncStorage.setItem(`@${prefix}${name}`, JSON.stringify(data));
            await AsyncStorage.setItem(`${prefix}${name}`, JSON.stringify(data));
        },
        async loadCollection(name: string): Promise<null | Data> {
            // v2 const content = await AsyncStorage.getItem(`@${prefix}${name}`);
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
}
