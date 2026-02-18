# Instrucciones para Subir los Cambios

## Opción 1: Push Directo (Si tienes permisos)

```bash
cd /home/ubuntu/OguriCap-Bot
git push origin main
```

## Opción 2: Crear Pull Request

```bash
# 1. Crear una nueva rama
git checkout -b mejoras-panel-responsive

# 2. Push a la nueva rama
git push origin mejoras-panel-responsive

# 3. Ir a GitHub y crear Pull Request
# https://github.com/melodiabl/OguriCap-Bot/pulls
```

## Opción 3: Usar GitHub CLI

```bash
# Push y crear PR automáticamente
gh pr create --title "feat: mejoras completas del panel" --body "Ver CAMBIOS_REALIZADOS.md para detalles"
```

## Verificar Cambios Antes de Push

```bash
# Ver archivos modificados
git status

# Ver diferencias
git diff

# Ver log del commit
git log -1 --stat
```

## Archivos Modificados

- nginx/default.conf
- lib/email-service.js
- lib/panel-api.js
- frontend-next/src/app/globals.css
- frontend-next/src/components/ThemePaletteSelector.tsx (nuevo)
- frontend-next/src/components/layout/Header.tsx
- frontend-next/src/components/notifications/NotificationDropdown.tsx

Total: 7 archivos (6 modificados, 1 nuevo)
