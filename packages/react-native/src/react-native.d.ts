declare module "react-native" {
    type AsyncStorageType = {
        setItem(key: string, value: string): Promise<void>,
        getItem(key: string): Promise<string>,
    }
    
    export const AsyncStorage: AsyncStorageType;
}