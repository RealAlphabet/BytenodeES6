/**
 *
 *      ██████╗░██╗░░░██╗████████╗███████╗███╗░░██╗░█████╗░██████╗░███████╗  ███████╗░██████╗░█████╗░
 *      ██╔══██╗╚██╗░██╔╝╚══██╔══╝██╔════╝████╗░██║██╔══██╗██╔══██╗██╔════╝  ██╔════╝██╔════╝██╔═══╝░
 *      ██████╦╝░╚████╔╝░░░░██║░░░█████╗░░██╔██╗██║██║░░██║██║░░██║█████╗░░  █████╗░░╚█████╗░██████╗░
 *      ██╔══██╗░░╚██╔╝░░░░░██║░░░██╔══╝░░██║╚████║██║░░██║██║░░██║██╔══╝░░  ██╔══╝░░░╚═══██╗██╔══██╗
 *      ██████╦╝░░░██║░░░░░░██║░░░███████╗██║░╚███║╚█████╔╝██████╔╝███████╗  ███████╗██████╔╝╚█████╔╝
 *      ╚═════╝░░░░╚═╝░░░░░░╚═╝░░░╚══════╝╚═╝░░╚══╝░╚════╝░╚═════╝░╚══════╝  ╚══════╝╚═════╝░░╚════╝░
 *
 *      @Author         RealAlphabet
 *      @Description    A minimalist bytecode compiler for NodeJS ES6 Modules.
 *      @Version        1.0.2
 */

//  ROLLUP

const { rollup }    = require('rollup');
const { terser }    = require('rollup-plugin-terser');

//  BYTENODE

const v8    = require('v8');
const vm    = require('vm');
const fs    = require('fs');


///////////////////////////////
//  FLAGS
///////////////////////////////


/** @IMPORTANT **/
v8.setFlagsFromString('--no-lazy');                     // Thanks to @bytenode project
                                                        // Make the v8 engine compile the full source code.

Number.parseInt(process.versions.node, 10) >= 12
    && v8.setFlagsFromString('--no-flush-bytecode');    // Thanks to A-Parser (@a-parser)


///////////////////////////////
//  COMPILE
///////////////////////////////


function compileCode(code) {
    return (new vm.SourceTextModule(code)).createCachedData();
}

function compileFile(file) {
    return (new vm.SourceTextModule(fs.readFileSync(file, 'utf-8'))).createCachedData();
}


///////////////////////////////
//  UTILS
///////////////////////////////


//  BYTECODE

function fixBytecode(bytecode) {
    let version         = process.version.substring(1, 3);
    let dummyBytecode   = compileCode('"ಠ_ಠ"');

    if (['8.8', '8.9'].includes(version)) {
        dummyBytecode.slice(16, 20).copy(bytecode, 16);
        dummyBytecode.slice(20, 24).copy(bytecode, 20);

    } else if (['12', '13', '14', '15', '16'].includes(version)) {
        dummyBytecode.slice(12, 16).copy(bytecode, 12);

    } else {
        dummyBytecode.slice(12, 16).copy(bytecode, 12);
        dummyBytecode.slice(16, 20).copy(bytecode, 16);
    }

    return (bytecode);
}

//  SOURCE

function readSourceHash(bytecode) {
    let bytes   = bytecode.slice(8, 12);
    let length  = (bytes[3] << 24) | (bytes[2] << 16) | (bytes[1] << 8) | bytes[0];

    // Remove is_module flag.
    return (length & ~(1 << 31));
}

function generateSourceHash(bytecode) {
    let length = readSourceHash(bytecode);

    return ((length > 1)
        ? '"' + '\u200b'.repeat(length - 2) + '"'
        : '');
}


///////////////////////////////
//  BYTENODE ES6
///////////////////////////////


//  LINKER

async function linker(specifier, reference) {

    //  BYTECODE

    if (specifier.endsWith('.jsc'))
        return (runByteCode(specifier, reference.context));

    //  COMMONJS

    function loader() {
        // Set default export.
        this.setExport('default', obj);

        // Set root exports.
        for (let [k, v] of Object.entries(obj))
            this.setExport(k, v);
    }

    // Require CommonJS module.
    let obj     = require.main.require(specifier);
    let keys    = [ 'default', ...Object.keys(obj) ];

    // Wrap Synthetic Module.
    let module  = new vm.SyntheticModule(keys, loader, {
        context: reference.context,
    });

    return (module);
}

//  RUNNER

async function runByteCode(param, context) {
    // Read bytecode from file.
    if (typeof param == 'string')
        param = fs.readFileSync(param);

    // Fix bytecode.
    let byteCode = fixBytecode(param);

    // Module from bytecode.
    let module = new vm.SourceTextModule(generateSourceHash(byteCode), {
        cachedData: byteCode,
        context
    });

    // Check cached data.
    if (module.cachedDataRejected)
        throw `[VM] Cached data rejected.`;

    // Link and evaluate module.
    await module.link(linker);
    await module.evaluate();
    return (module);
}


///////////////////////////////
//  SPECIALS
///////////////////////////////


//  BUNDLER

async function bundleAndCompile(file) {
    // Setup rollup with source file.
    let process = await rollup({
        input   : file,
        onwarn  : () => {}
    });

    // Generate bundle.
    let result = await process.generate({
        format  : 'es',
        plugins : [ terser() ]
    });

    // Compile bundle to bytecode.
    return (compileCode(result.output[0].code));
}

//  INSTANCER

async function instantiate(file) {
    return (await runByteCode(file)).namespace.default;
}


///////////////////////////////
//  EXPORTS
///////////////////////////////


module.exports = {
    compileCode,
    compileFile,
    bundleAndCompile,
    instantiate
};
