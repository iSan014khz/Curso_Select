const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluar, preguntas } = require('../JS/diagnostico');

test('puntua aciertos reales y distingue areas sin inferir admision', () => {
    const r = evaluar([1, 2, 3, 0, 0, 0]);
    assert.equal(r.porcentaje, 50);
    assert.equal(r.correctas, 3);
    assert.deepEqual(r.areas.map(a => [a.nombre, a.porcentaje]), [['Matemáticas', 100], ['Comprensión lectora', 0]]);
    assert.equal('probabilidadAdmision' in r, false);
});
test('respuestas completas correctas o incorrectas dan 100 o cero', () => {
    assert.equal(evaluar([1, 2, 3, 1, 1, 2]).porcentaje, 100);
    assert.equal(evaluar([0, 0, 0, 0, 0, 0]).porcentaje, 0);
    assert.equal(preguntas.length, 6);
});
test('no da un resultado a respuestas incompletas o manipuladas', () => {
    for (const r of [null, [], [1, 2, 3, 1, 1], [1, 2, 3, 1, 1, 4], [1, 2, 3, 1, 1, '2'], [1, 2, 3, 1, 1, null]]) {
        assert.throws(() => evaluar(r), /seis preguntas/);
    }
});
