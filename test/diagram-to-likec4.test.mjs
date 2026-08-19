import assert from 'node:assert/strict'
import { execFile as execFileCallback, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { deflateRawSync } from 'node:zlib'
import test from 'node:test'

const execFile = promisify(execFileCallback)
const AC = new URL('..', import.meta.url).pathname
const SCRIPT = join(AC, 'skills', 'diagram-to-likec4', 'scripts', 'diagram_to_likec4.py')
const HAS_PYTHON = spawnSync('python3', ['--version']).status === 0

const graphModel = (apiLabel = 'API') => `<mxGraphModel><root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="a" value="&lt;b&gt;${apiLabel}&lt;/b&gt;" vertex="1" parent="1"/>
  <mxCell id="b" value="Database" vertex="1" parent="1"/>
  <mxCell id="e" value="reads" edge="1" source="a" target="b" parent="1"/>
</root></mxGraphModel>`

const runConverter = async (source, destination) => {
  try {
    const { stdout, stderr } = await execFile('python3', [SCRIPT, source, destination])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    }
  }
}

test('diagram converter handles Excalidraw, plain draw.io, compressed draw.io, and draw.io SVG', {
  skip: HAS_PYTHON ? false : 'python3 is required',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-diagram-'))
  try {
    const excalidraw = join(root, 'system.excalidraw')
    await writeFile(excalidraw, JSON.stringify({
      elements: [
        { id: 'shape-a', type: 'rectangle' },
        { id: 'label-a', type: 'text', containerId: 'shape-a', text: 'Web API' },
        { id: 'shape-b', type: 'ellipse' },
        { id: 'label-b', type: 'text', containerId: 'shape-b', text: 'Database' },
        {
          id: 'edge',
          type: 'arrow',
          startBinding: { elementId: 'shape-a' },
          endBinding: { elementId: 'shape-b' },
          text: 'reads',
        },
      ],
    }))

    const plain = join(root, 'plain.drawio')
    const plainModel = graphModel()
    const plainDrawio = `<mxfile><diagram name="Page 1">${plainModel}</diagram></mxfile>`
    await writeFile(plain, plainDrawio)

    const compressed = join(root, 'compressed.drawio')
    const encoded = encodeURIComponent(graphModel('Worker'))
    const body = deflateRawSync(Buffer.from(encoded)).toString('base64')
    await writeFile(compressed, `<mxfile><diagram name="Page 1">${body}</diagram></mxfile>`)

    const embedded = join(root, 'embedded.drawio.svg')
    const attribute = plainDrawio
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
    await writeFile(embedded, `<svg xmlns="http://www.w3.org/2000/svg" content="${attribute}"/>`)

    const cases = [
      [excalidraw, /web_api = node 'Web API'/],
      [plain, /api = node 'API'/],
      [compressed, /worker = node 'Worker'/],
      [embedded, /api = node 'API'/],
    ]

    for (const [source, expectedNode] of cases) {
      const destination = `${source}.c4`
      const result = await runConverter(source, destination)
      assert.equal(result.code, 0, result.stderr)
      const output = await readFile(destination, 'utf8')
      assert.match(output, expectedNode)
      assert.match(output, /api|web_api|worker/)
      assert.match(output, /-> database 'reads'/)
      assert.match(output, /specification \{/)
      assert.match(output, /model \{/)
      assert.match(output, /views \{/)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('diagram converter rejects formats that do not contain a structured architecture model', {
  skip: HAS_PYTHON ? false : 'python3 is required',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-diagram-reject-'))
  try {
    const mermaid = join(root, 'system.mmd')
    await writeFile(mermaid, 'flowchart LR\nA --> B\n')
    const unsupported = await runConverter(mermaid, join(root, 'mermaid.c4'))
    assert.equal(unsupported.code, 2)
    assert.match(unsupported.stderr, /unsupported input/)

    const svg = join(root, 'picture.drawio.svg')
    await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const missingModel = await runConverter(svg, join(root, 'svg.c4'))
    assert.equal(missingModel.code, 1)
    assert.match(missingModel.stderr, /no embedded draw.io model/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
