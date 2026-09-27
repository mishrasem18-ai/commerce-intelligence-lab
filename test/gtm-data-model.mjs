// GTM's data model: what a Data Layer Variable (Version 2) returns after a
// sequence of window.dataLayer pushes. A minimal port of the merge in
// google/data-layer-helper, which GTM uses. Each plain-object push is merged
// key by key into one model that lasts for the whole page. Plain objects and
// arrays merge recursively. Any other value, including an explicit
// `undefined`, replaces the key's value. A key the push omits keeps its
// previous value.
//
// Out of scope: command pushes (`arguments` objects, such as Consent Mode),
// which are skipped, and dotted-key expansion (the app pushes no dotted keys
// besides `gtm.start`).

const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

function merge(from, to) {
  for (const key of Object.keys(from)) {
    const value = from[key];
    if (Array.isArray(value)) {
      if (!Array.isArray(to[key])) to[key] = [];
      merge(value, to[key]);
    } else if (isPlainObject(value)) {
      if (!isPlainObject(to[key])) to[key] = {};
      merge(value, to[key]);
    } else {
      to[key] = value;
    }
  }
}

/**
 * @param {readonly unknown[]} pushes window.dataLayer, in push order
 * @returns {Record<string, unknown>}
 */
export function gtmDataModel(pushes) {
  const model = {};
  for (const push of pushes) if (isPlainObject(push)) merge(push, model);
  return model;
}
