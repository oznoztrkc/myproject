import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSource } from './validation.ts'

test('1: Kaynak 1150 TL → AI 1150 TL = PASS; güvenli biçimleme', () => {
  assert.deepEqual(validateSource('nakil ucreti 1150 tl', 'nakil ucreti 1150 tl', 'nakil ucreti 1150 tl'), { start: 0, end: 20 })
  assert.deepEqual(validateSource('nakil ucreti 1150 tl', 'nakil ucreti 1150 tl', 'Nakil ücreti 1.150 TL.'), { start: 0, end: 20 })
})
test('2: Kaynak 1150 TL → AI 1500 TL = FAIL', () => {
  assert.throws(() => validateSource('nakil ucreti 1150 tl', 'nakil ucreti 1150 tl', 'Nakil ücreti 1.500 TL.'), /kaynak/)
})
test('3: Kaynak 7 iş günü → AI 10 iş günü = FAIL', () => {
  assert.throws(() => validateSource('Nakil 7 iş günü', 'Nakil 7 iş günü', 'Nakil 10 iş günü'), /kaynak/)
})
test('4: Kaynakta olmayan ücret eklenirse FAIL', () => {
  assert.throws(() => validateSource('Nakil işlemi yapılır.', 'Nakil işlemi yapılır.', 'Nakil işlemi 1150 TL karşılığında yapılır.'), /kaynak/)
})
test('Kaynakta olmayan şart, işlem adımı veya kod eklenirse FAIL', () => {
  assert.throws(() => validateSource('Nakil yapılır.', 'Nakil yapılır.', 'Nakil için öncelikle A123 kodunu girin.'), /kaynak/)
})
