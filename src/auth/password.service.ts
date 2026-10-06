import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_OPTIONS = Object.freeze({
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
});
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const HASH_PREFIX =
    `v1$scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}`;
const HASH_LENGTH = HASH_PREFIX.length + 2 + SALT_LENGTH * 2 + KEY_LENGTH * 2;

interface ParsedHash {
    salt: Buffer;
    key: Buffer;
}

@Injectable()
export class PasswordService implements OnModuleInit {
    private dummyHash?: Promise<string>;

    async onModuleInit(): Promise<void> {
        await this.getDummyHash();
    }

    async hash(password: string): Promise<string> {
        const salt = randomBytes(SALT_LENGTH);
        const key = await this.deriveKey(password, salt);

        return `${HASH_PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
    }

    async verify(password: string, storedHash: string): Promise<boolean> {
        const parsed = this.parseHash(storedHash);

        if (!parsed) {
            return false;
        }

        const key = await this.deriveKey(password, parsed.salt);

        return timingSafeEqual(key, parsed.key);
    }

    async verifyDummy(password: string): Promise<void> {
        await this.verify(password, await this.getDummyHash());
    }

    private getDummyHash(): Promise<string> {
        // Warm once during module initialization and reuse for missing credentials.
        this.dummyHash ??= this.hash(randomBytes(32).toString('hex'));

        return this.dummyHash;
    }

    private parseHash(storedHash: string): ParsedHash | null {
        if (storedHash.length !== HASH_LENGTH) {
            return null;
        }

        const parts = storedHash.split('$');

        // Accept only the canonical v1 profile before starting any scrypt work.
        if (parts.length !== 7 || parts.slice(0, 5).join('$') !== HASH_PREFIX) {
            return null;
        }

        const saltHex = parts[5];
        const keyHex = parts[6];

        if (
            saltHex.length !== SALT_LENGTH * 2 ||
            keyHex.length !== KEY_LENGTH * 2 ||
            !/^[0-9a-f]+$/.test(saltHex) ||
            !/^[0-9a-f]+$/.test(keyHex)
        ) {
            return null;
        }

        return {
            salt: Buffer.from(saltHex, 'hex'),
            key: Buffer.from(keyHex, 'hex'),
        };
    }

    private deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(key);
            });
        });
    }
}
