import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PUBLIC_SELF_COMMANDS,
  canUseCommandInSelfMode,
} from '../lib/command-access.js'

describe('canUseCommandInSelfMode', () => {
  test('permite todos los alias públicos del menú a usuarios no propietarios', () => {
    for (const command of ['menu', 'menú', 'help', 'allmenu', 'ayuda']) {
      assert.equal(
        canUseCommandInSelfMode({ isOwner: false, selfMode: true, command }),
        true,
        `expected ${command} to be public`,
      )
    }
  })

  test('mantiene bloqueado un comando privado en modo self', () => {
    assert.equal(
      canUseCommandInSelfMode({ isOwner: false, selfMode: true, command: 'restart' }),
      false,
    )
  })

  test('no acepta coincidencias parciales', () => {
    assert.equal(
      canUseCommandInSelfMode({ isOwner: false, selfMode: true, command: 'menuowner' }),
      false,
    )
  })

  test('permite al propietario y permite a todos cuando self está apagado', () => {
    assert.equal(
      canUseCommandInSelfMode({ isOwner: true, selfMode: true, command: 'restart' }),
      true,
    )
    assert.equal(
      canUseCommandInSelfMode({ isOwner: false, selfMode: false, command: 'restart' }),
      true,
    )
  })

  test('expone una lista inmutable por convención con los alias esperados', () => {
    assert.deepEqual(
      [...PUBLIC_SELF_COMMANDS].sort(),
      ['allmenu', 'ayuda', 'help', 'menu', 'menú'].sort(),
    )
  })
})
