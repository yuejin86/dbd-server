import type { SaveData } from './types/types'

import * as crypto from 'crypto'
import * as zlib from 'zlib'
import * as path from 'path'
import * as fs from 'fs'
import HJSON from 'hjson'

import * as StartingValues from './starting-values.js'

import key from '../private/savekey.js'
const iv = ''

const DEFAULT_SAVE_PATH = path.join('.', 'json', 'defaultSave.json')
const DEFAULT_SAVE = (() => {
    if(fs.existsSync(DEFAULT_SAVE_PATH)) {
        const saveObj = HJSON.parse(fs.readFileSync(DEFAULT_SAVE_PATH).toString()) as SaveData
        saveObj.bonusExperience = StartingValues.bloodpoints
        return encryptDbD(Buffer.from(JSON.stringify(saveObj), 'utf16le'))
    } else {
        return null
    }
})()

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export function decryptDbD(encryptedData: string): Buffer {
    let data: any = encryptedData
    data = data.substr(8) // is always DbdDAgAC
    data = Buffer.from(data, 'base64')
    data = decrypt(data)
    for(let i = 0;i < data.length;i++) {
        data[i]++
    }
    data = data.slice(8) // is always 0x44 62 64 44 41 51 45 42
    data = Buffer.from(data.toString(), 'base64')
    data = data.slice(4) // is always a 32-bit LE integer denoting the size of the plaintext
    data = zlib.inflateSync(data)
    return data as Buffer
}

export function encryptDbD(plainData: Buffer): string {
    let data: any = plainData

    const dataSize = plainData.length
    const bufferA = Buffer.alloc(4)
    bufferA.writeInt32LE(dataSize)

    data = zlib.deflateSync(data)
    data = appendBuffers(bufferA, data)
    data = Buffer.from(data.toString('base64'))
    data = appendBuffers(Buffer.of(0x44, 0x62, 0x64, 0x44, 0x41, 0x51, 0x45, 0x42), data)
    for(let i = 0;i < data.length;i++) {
        data[i]--
    }
    data = encrypt(data)
    data = data.toString('base64')
    data = 'DbdDAgAC' + (data as string)
    return data as string
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment */

export function decryptSave(saveData: string): SaveData {
    const save = decryptDbD(saveData)
    return JSON.parse(save.toString('utf16le')) as SaveData
}

function decrypt(data: Buffer): Buffer {
    const cipher = crypto.createDecipheriv('aes-256-ecb', key, iv)
    cipher.setAutoPadding(false)
    let hex = ''
    hex = cipher.update(data).toString('hex')
    hex += cipher.final().toString('hex')
    let outBuffer = Buffer.from(hex, 'hex')
    if(outBuffer[outBuffer.length - 1] === 0) {
        while(outBuffer[outBuffer.length - 1] === 0) {
            outBuffer = outBuffer.slice(0, outBuffer.length - 1)
        }
    } else {
        const paddingCount = outBuffer[outBuffer.length - 1]
        outBuffer = outBuffer.slice(0, outBuffer.length - paddingCount)
    }
    return outBuffer
}

function encrypt(data: Buffer): Buffer {
    const cipher = crypto.createCipheriv('aes-256-ecb', key, iv)
    cipher.setAutoPadding(false)
    const paddingByteCount = (32 - (data.length % 32)) || 32
    data = appendBuffers(data, Buffer.alloc(paddingByteCount, 0))
    return appendBuffers(cipher.update(data), cipher.final())
}

function appendBuffers(a: Buffer, b: Buffer): Buffer {
    const out = Buffer.alloc(a.length + b.length)
    for(let i = 0;i < a.length;i++) {
        out[i] = a[i]
    }
    for(let i = 0;i < b.length;i++) {
        out[a.length + i] = b[i]
    }
    return out
}

export function defaultSaveExists(): boolean {
    return !!DEFAULT_SAVE
}

export function getDefaultSave(): string {
    if(!defaultSaveExists()) {
        return ''
    }
    return DEFAULT_SAVE
}
