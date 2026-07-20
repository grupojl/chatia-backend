#!/usr/bin/env bash
# =============================================================================
# fix-chatia-conversations-service.sh
# Fix: ConversationsService tiene @InjectQueue(OUTGOING_MESSAGE) sin @Optional
# Repo: chatia-backend
# =============================================================================
set -euo pipefail

FILE="src/conversations/conversations.service.ts"

if [ ! -f "$FILE" ]; then
  echo "❌  Corré desde la raíz del repo chatia-backend"
  exit 1
fi

cp "$FILE" "${FILE}.bak"

# Reemplazar solo la línea del constructor con @InjectQueue
# El import de Optional ya está en el archivo (lo agregamos antes)
sed -i 's|@InjectQueue(QUEUES.OUTGOING_MESSAGE)|@Optional() @InjectQueue(QUEUES.OUTGOING_MESSAGE)|' "$FILE"
sed -i 's|private readonly outgoingQueue: Queue<OutgoingMessageJobData>,|private readonly outgoingQueue: Queue<OutgoingMessageJobData> \| null,|' "$FILE"

echo "✅  Constructor actualizado"

# Buscar el método que llama a this.outgoingQueue.add y agregar guard
# Usamos node para hacer el reemplazo seguro
node -e "
const fs   = require('fs');
let   src  = fs.readFileSync('$FILE', 'utf8');

// Reemplazar llamadas directas a this.outgoingQueue.add con guard
src = src.replace(
  /await this\.outgoingQueue\.add\(/g,
  'if (this.outgoingQueue) await this.outgoingQueue.add('
);

// Cerrar el if: buscar el patrón de cierre de la llamada add(...)
// La llamada termina con ); o },\n      );\n  — necesitamos envolverla
// Enfoque más seguro: solo logear si no hay queue
src = src.replace(
  /if \(this\.outgoingQueue\) await this\.outgoingQueue\.add\(/g,
  'if (!this.outgoingQueue) { this.logger?.warn(\"[no-op] outgoingQueue deshabilitada\"); } else await this.outgoingQueue.add('
);

fs.writeFileSync('$FILE', src);
console.log('Llamadas a outgoingQueue protegidas');
" 2>/dev/null || echo "⚠️  Reemplazo de llamadas no aplicado — verificá manualmente los usos de this.outgoingQueue"

echo ""
echo "📄  Verificando cambios en constructor:"
grep -n "outgoingQueue\|@Optional\|@InjectQueue" "$FILE" | head -20

echo ""
echo "🔍  Otros @InjectQueue sin @Optional en el proyecto:"
grep -r "@InjectQueue" src/ --include="*.ts" -l | while read f; do
  if ! grep -q "@Optional" "$f"; then
    echo "   ⚠️  $f"
  fi
done

echo ""
echo "✅  Reiniciá el contenedor"