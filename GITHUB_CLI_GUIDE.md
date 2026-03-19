# 🚀 Guia Completa: GitHub CLI (gh)

## 1. Instal·lació

### **En Windows (Recomanat)**
La millor manera és fer servir winget (el gestor oficial de Microsoft):
```powershell
winget install --id GitHub.cli
```
*Nota: Un cop instal·lat, tanca i torna a obrir la terminal perquè es reconegui el comando.*

### **En Ubuntu / Linux (Debian/Ubuntu)**
Executa aquest bloc per afegir el repositori oficial de GitHub:
```bash
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
&& sudo mkdir -p -m 755 /etc/apt/keyrings \
&& wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update \
&& sudo apt install gh -y
```

---

## 2. Autenticació (Login)

Abans de fer res, has de vincular la teva terminal amb el teu compte de GitHub.

```bash
gh auth login
```

**Passos a seguir en l'assistent:**
1. **What account?** GitHub.com
2. **Preferred protocol?** HTTPS
3. **Authenticate Git?** Yes
4. **How to authenticate?** Login with a web browser
5. Copia el **codi de 8 digits** que sortirà a la pantalla.
6. Prem Enter (s'obrirà el navegador).
7. Enganxa el codi i accepta els permisos.

---

## 3. Flux de Treball: Crear un Repositori Nou

Si tens una carpeta al teu ordinador i la vols pujar a GitHub per primera vegada:

```bash
# 1. Entra a la carpeta
cd ruta/del/teu/projecte

# 2. Inicialitza Git localment (si no ho has fet ja)
git init

# 3. Crea el repositori a GitHub des de la terminal
gh repo create el-nom-del-repo --public --source=. --remote=origin --push
```
* `--public`: El fa visible a tothom.
* `--source=.`: Diu que el codi és a la carpeta actual.
* `--remote=origin`: Configura automàticament la connexió Git.
* `--push`: Puja el codi immediatament.

---

## 4. Flux de Treball: Anar a un Repo Existent

### **Clonar un repositori** (Baixar-lo de GitHub)
```bash
gh repo clone usuari/nom-del-repo
```

### **Vincular una carpeta local a un repo que ja existeix a GitHub**
```bash
gh repo set-default usuari/nom-del-repo
```

---

## ⚠️ Atenció: El conflicte amb NPM (IMPORTANT)
Si en executar gh veus errors de "TypeError" o fitxers de Node.js, és perquè tens instal·lat un paquet antic de npm anomenat gh que no és l'oficial.

**Com arreglar-ho:**
1. Desinstal·la la versió dolenta: `npm uninstall -g gh`
2. Verifica que fas servir la bona: `where gh` (Windows) o `which gh` (Linux).
3. Hauria de sortir una ruta com `C:\Program Files\GitHub CLI\bin\gh.exe` o `/usr/bin/gh`.
