@echo off
echo Guardando cambios actuales...
git add .
git commit -m "Auto-commit antes de merge a main"

echo Cambiando a rama main...
git checkout main

echo Actualizando main desde remoto...
git pull origin main

echo Haciendo merge de ptlRamaTrabajo en main...
git merge ptlRamaTrabajo

echo Subiendo main al remoto...
git push origin main

echo Proceso completado.
pause