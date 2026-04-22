import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../crypto.js";

describe("encrypt/decrypt", () => {
	const originalKey = process.env.ENCRYPTION_KEY;

	beforeAll(() => {
		process.env.ENCRYPTION_KEY = "a]3Kz!9pR@mW#dLx7vQn2Yb$fE8hT0cS";
	});

	afterAll(() => {
		if (originalKey) {
			process.env.ENCRYPTION_KEY = originalKey;
		} else {
			delete process.env.ENCRYPTION_KEY;
		}
	});

	it("encrypts and decrypts a string", () => {
		const plaintext = "hello world";
		const encrypted = encrypt(plaintext);
		expect(encrypted).not.toBe(plaintext);
		expect(decrypt(encrypted)).toBe(plaintext);
	});

	it("produces different ciphertexts for the same input (random IV)", () => {
		const plaintext = "same input";
		const a = encrypt(plaintext);
		const b = encrypt(plaintext);
		expect(a).not.toBe(b);
		expect(decrypt(a)).toBe(plaintext);
		expect(decrypt(b)).toBe(plaintext);
	});

	it("encrypts empty string", () => {
		const encrypted = encrypt("");
		expect(decrypt(encrypted)).toBe("");
	});

	it("handles unicode content", () => {
		const plaintext = "Hello 🌍 Welt";
		const encrypted = encrypt(plaintext);
		expect(decrypt(encrypted)).toBe(plaintext);
	});

	it("handles long strings", () => {
		const plaintext = "x".repeat(10000);
		const encrypted = encrypt(plaintext);
		expect(decrypt(encrypted)).toBe(plaintext);
	});

	it("output is base64 encoded", () => {
		const encrypted = encrypt("test");
		expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
	});

	it("throws on invalid key length", () => {
		process.env.ENCRYPTION_KEY = "short";
		expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be exactly 32 characters");
		process.env.ENCRYPTION_KEY = "a]3Kz!9pR@mW#dLx7vQn2Yb$fE8hT0cS";
	});

	it("throws on tampered ciphertext", () => {
		const encrypted = encrypt("test");
		const tampered = `${encrypted.slice(0, -2)}XX`;
		expect(() => decrypt(tampered)).toThrow();
	});
});
