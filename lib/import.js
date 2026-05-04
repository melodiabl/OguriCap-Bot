import { fileURLToPath } from 'url'
import path from 'path'

const __filename = (p) => /^file:\/\//.test(p) ? fileURLToPath(p) : p

export default async function importFile(module) {
    module = __filename(typeof module === 'string' ? module : module?.url || module)
    const module_ = await import(`${module}?id=${Date.now()}`)
    return module_ && 'default' in module_ ? module_.default : module_
}
