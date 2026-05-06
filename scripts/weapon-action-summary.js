console.log("PF1e Weapon Action Summary | Loaded");

function getRoot(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return Array.from(value.values());
  if (typeof value === "object") return Object.values(value);
  return [];
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function titleCase(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function simplifyPF1Formula(formula) {
  let text = cleanText(formula);

  // PF1e commonly stores weapon base damage as sizeRoll(1, 6, @size)
  // For a Medium creature/item sheet display, show this as 1d6.
  text = text.replace(/sizeRoll\(\s*(\d+)\s*,\s*(\d+)\s*,\s*@size\s*\)/gi, "$1d$2");

  return text;
}

function getActionLabel(action, index) {
  const rangeUnits = cleanText(action.range?.units).toLowerCase();
  const actionType = cleanText(action.actionType).toLowerCase();
  const name = cleanText(action.name);

  if (rangeUnits === "melee") return "melee";
  if (rangeUnits === "thrown") return "throw";
  if (rangeUnits === "throw") return "throw";
  if (rangeUnits === "ranged") return "ranged";

  if (actionType === "mwak") return "melee";
  if (actionType === "rwak") return "ranged";
  if (actionType === "msak") return "melee touch";
  if (actionType === "rsak") return "ranged touch";

  if (name && name.toLowerCase() !== "attack") return name;

  return `attack ${index + 1}`;
}

function parseDamagePart(part) {
  if (!part) return null;

  if (typeof part === "string") {
    const formula = simplifyPF1Formula(part);
    if (!formula) return null;

    return {
      formula,
      type: ""
    };
  }

  if (Array.isArray(part)) {
    const formula = simplifyPF1Formula(part[0]);
    const type = cleanText(part[1]);

    if (!formula) return null;

    return {
      formula,
      type
    };
  }

  if (typeof part === "object") {
    const formula = simplifyPF1Formula(
      part.formula ??
      part.value ??
      part.roll ??
      part.damage ??
      part.base ??
      part.normal ??
      part[0]
    );

    const types = asArray(part.types);
    const type =
      types.length > 0
        ? types.map(titleCase).join(", ")
        : titleCase(
            part.type ??
            part.damageType ??
            part.damageTypeId ??
            part.category ??
            part[1]
          );

    if (!formula) return null;

    return {
      formula,
      type
    };
  }

  return null;
}

function extractDamageParts(action) {
  const collections = [
    action.damage?.parts,
    action.damage?.normal?.parts,
    action.damage?.base?.parts,
    action.damageParts,
    action.parts
  ];

  const results = [];

  for (const collection of collections) {
    if (!collection) continue;

    for (const part of asArray(collection)) {
      const parsed = parseDamagePart(part);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

function getWeaponActions(item) {
  const system = item.system ?? {};
  const actions = asArray(system.actions);

  return actions
    .map((action, index) => {
      const name = getActionLabel(action, index);
      const damageParts = extractDamageParts(action);

      if (!damageParts.length) return null;

        const damageText = damageParts
        .map(part => {
            if (part.type) {
            return `${part.formula} / ${abbreviateDamageTypes(part.type)}`;
            }
            return part.formula;
        })
        .join("; ");

      return {
        name,
        damageText
      };
    })
    .filter(Boolean);
}

function findQuantityRow(root) {
  const quantityInput = root.querySelector("section.sidebar input[name='system.quantity']");
  if (!quantityInput) return null;

  return quantityInput.closest("label.descriptor");
}

function createActionRow(action) {
  const row = document.createElement("label");
  row.className = "descriptor sor-weapon-action-summary-row";

  // Add a subtle gray field behind the damage, like PF1e's normal value fields.
  row.style.alignItems = "center";

  const name = document.createElement("span");
  name.textContent = capitalizeFirst(action.name);

  const damage = document.createElement("span");
  damage.className = "sor-weapon-action-summary-damage";
  damage.textContent = action.damageText;

  damage.style.textAlign = "right";
  damage.style.display = "block";
  damage.style.minWidth = "0";
  damage.style.overflowWrap = "anywhere";
  damage.style.background = "rgba(0, 0, 0, 0.08)";
  damage.style.padding = "1px 4px";
  damage.style.borderRadius = "2px";

  row.appendChild(name);
  row.appendChild(damage);

  return row;
}

function injectWeaponActionSummary(item, root) {
  if (!item || item.type !== "weapon") return;
  if (!root) return;

  root.querySelectorAll(".sor-weapon-action-summary-row").forEach(el => el.remove());

  const actions = getWeaponActions(item);
  if (!actions.length) return;

  const quantityRow = findQuantityRow(root);
  if (!quantityRow) {
    console.warn("PF1e Weapon Action Summary | Could not find Quantity row.");
    return;
  }

  for (const action of actions) {
    quantityRow.insertAdjacentElement("beforebegin", createActionRow(action));
  }
}

function capitalizeFirst(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function abbreviateDamageTypes(typeText) {
  const text = cleanText(typeText);
  if (!text) return "";

  return text
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.charAt(0).toUpperCase())
    .join(",");
}

Hooks.on("renderItemSheet", (app, html) => {
  const item = app.item ?? app.document;
  const root = getRoot(html);

  injectWeaponActionSummary(item, root);
});