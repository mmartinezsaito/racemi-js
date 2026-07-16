
// Parameter initialization
const nd = 2;
const numAtomTypes = 3;
const maxNumCol = 7;
const numAtoms = 60;
const atomRadius = 4;
const interactionRange = 1000; // 80;
const minClusMembCount = 2;
const maxNumLiveClusters = numAtoms * (1/(1 - 1/5) - 1); // 2->1, 4->1/3, 5->1/4,
const irrdisn = 1 - nd;           // attraction force irradiance to distance power law: I ~ d^(irrdisn)
const maxRange = 2000; 
const palette = ['magenta', 'green', 'blue', 'teal', 'lavender', 'yellow', 'cyan', 'red'];
const wallElasticity = 0; //0.1;
const dampCoef = .07; //0.7;
const w = 0.05;  // mean-reversion parameter or learning rate
const sphericalVar = false; 

const settings = {
    seed: 91651088029,
    fps: 0,
    atoms: {
	count: numAtoms / numAtomTypes,  // per color
	radius: atomRadius,
	mass: 1,
    },
    regularPotential: true,
    drawings: {  // drawing options can be expensive on performance
	forcelines: false,    // central force lines between interacting atoms 
	round: false,         // draw round atoms 
	clusters: false,
	background_color: '#00000000', 
    },
    explore: false,
    explorationPeriod: 100,
    logTimeStep: 0,
    interactionCoefficients: {},
    range: {},
    colors: [],
    numColors: numAtomTypes,
    maxNumLiveClusters: maxNumLiveClusters,
    interactionLaw: irrdisn, 
    interactionLog10scale: 0, 
    damping: Math.log10(dampCoef),  // speed-dampening (can be >1 !)
    isViscous: true,
    gravity: 0.0,  // pulling downward
    prodStrengthAndDuration: 10,
    cw: 0.8,
    ch: 0.95,
    wrapAround: false,
    wallThickness: 40,
    wallElasticity: wallElasticity,
    reset: () => restartAtoms(settings.atoms.count, true),
    randomInteractions: () => {
	settings.seed += 0x6D2B79F5;  // change seed
	resetWorld();
    },
    symmetrizeInteractions: () => {
	symmetrizeInteractions();
	restartAtoms(settings.atoms.count, true);
	updateGuiDisplay();
    },
    skewsymmetrizeInteractions: () => {
	skewsymmetrizeInteractions();
	restartAtoms(settings.atoms.count, true);
	updateGuiDisplay();
    },
    gui: null,
    showplots: false,
    export: {     
	image: () => {   // screenshot image
	    const imageDataURL = canv.toDataURL({format: 'png', quality: 1});
	    dataUrlDownloader(imageDataURL);
	},
	video: () => mediaRecorder.state == 'recording' ? mediaRecorder.stop() : mediaRecorder.start(), // video recording
	data: () => dataExporter(), 
    },
}


/*** SET UP GUI ***/

const setupProd = () => {
    canv.addEventListener('click', (me) => {prod_st = settings.prodStrengthAndDuration;   // MouseEvent
					    if (me.shiftKey) prod_st = -prod_st;        // if shiftKey then attract
					    prod_x = me.offsetX; prod_y = me.offsetY;   // me.clientX is wrt the screen
					    console.log(`coordinates: ${prod_x}, ${prod_y}`);
    })
}

function setupHotkeys() {
    canv.addEventListener('keydown', (ke) => {  // KeyboardEvent
	console.log(ke.key);
	switch (ke.key) {
	    case 'r': settings.randomInteractions();                            break;
	    case 'c': settings.drawings.clusters = !settings.drawings.clusters; break;
	    case ' ': settings.reset();                                         break;
	    case 's': settings.symmetrizeInteractions();                        break;
	    case 'a': settings.skewsymmetrizeInteractions();                    break;
	    default: ;
	};
    })
    let titl = document.getElementsByClassName("title")[0]; // document..querySelector('div.title[tabindex="0"]')
    canv.addEventListener("keydown", (ke) => {
	const aeb = JSON.parse(titl.getAttribute("aria-expanded")); 		
	if (ke.key=="t") {
	    titl.setAttribute("aria-expanded", (!aeb).toString()); 
	    if (gui._closed) gui.open(); else gui.close();
	}
    }); 
}

const updateGuiDisplay = () => {
    console.log('gui', gui);
    gui.destroy();
    setupGui();
}

Object.defineProperty(String.prototype, 'capitalize', {
    value: function() {return this.charAt(0).toUpperCase() + this.slice(1)},
    enumerable: false
})

const setupGui = () => {
    gui = new lil.GUI()
    gui.title("Controls (t)");		    

    // Physics
    const physicsFolder = gui.addFolder('Physics')
    physicsFolder.add(settings, 'numColors', 1, maxNumCol, 1).name('Number of colors').listen().onFinishChange(v => {setColors(); resetWorld();})
    physicsFolder.add(settings.atoms, 'count', 1, numAtomsNow()/numAtomTypes*2, 1).name('Atoms per color').listen().onFinishChange(v => restartAtoms(v, true))
    physicsFolder.add(settings, 'regularPotential').name('Regular potential').listen()
    physicsFolder.add(settings.atoms, 'radius', 1, 100, 0.5).name('Atom radius').listen()
    physicsFolder.add(settings.atoms, 'mass', .01, 10, .01).name('Atom mass').listen()
    physicsFolder.add(settings, 'interactionLaw', -3, 3, .001).name('Interaction law exponent').listen()
    physicsFolder.add(settings, 'interactionLog10scale', -3, 3, .01).name('Interaction logscale').listen()
    physicsFolder.add(settings, 'randomInteractions').name('Random interactions (r)')
    physicsFolder.add(settings, 'symmetrizeInteractions').name('Symmetrize interactions (s)')
    physicsFolder.add(settings, 'skewsymmetrizeInteractions').name('Skew-symmetrize interactions (a)')
    physicsFolder.add(settings, 'isViscous').name('Viscosity')
    physicsFolder.add(settings, 'damping', -9, 2, .1).name('Log10 damping').listen()
    physicsFolder.add(settings, 'gravity', 0., 5, 0.05).name('Gravity').listen()
    physicsFolder.add(settings, 'cw', 0, 1, .001).name('Canvas width').listen()
    physicsFolder.add(settings, 'ch', 0, 1, .001).name('Canvas height').listen()
    physicsFolder.add(settings, 'wrapAround').name('Wrap around').listen()
    physicsFolder.add(settings, 'wallThickness', 0, 500, 1).name('Wall thickness').listen()
    physicsFolder.add(settings, 'wallElasticity', 0, 10, .01).name('Wall elasticity').listen()
    physicsFolder.add(settings, 'logTimeStep', -2, 1, .1).name('Log10 time step').listen()

    // Sundries
    const sundriesFolder = gui.addFolder('Sundries')
    sundriesFolder.add(settings, 'reset').name('Reset ( )')
    sundriesFolder.add(settings, 'fps').name('fps').listen().disable()
    sundriesFolder.add(settings, 'seed').name('Seed').listen().onFinishChange(v => resetWorld())
    sundriesFolder.add(settings, 'explore').name('Parameter exploration').listen()
    sundriesFolder.add(settings.drawings, 'clusters').name('Track clusters (c)').listen()
    sundriesFolder.add(settings, 'maxNumLiveClusters', 1, numAtomsNow(), 1).name('Max. num. of clusters').listen()
    sundriesFolder.add(settings, 'prodStrengthAndDuration', 1, 100, 1).name('Prod strength and duration').listen()

    // Drawings
    const drawingsFolder = gui.addFolder('Drawings')
    drawingsFolder.add(settings.drawings, 'round').name('Round atoms').listen()
    drawingsFolder.add(settings.drawings, 'forcelines').name('Center force lines').listen()
    drawingsFolder.addColor(settings.drawings, 'background_color').name('Background color').listen()
    drawingsFolder.add(settings, 'showplots').name('Plot').listen()

    // Color interactions
    for (const atomColor of settings.colors) {
	const colorFolder =
	    gui.addFolder(`Rules: <font color=\'${atomColor}\'>${atomColor.capitalize()}</font>`)
	for (const ruleColor of settings.colors) {
	    colorFolder.add(settings.interactionCoefficients[atomColor], ruleColor, -1, 1, 0.001)
		 .name(`<- <font color=\'${ruleColor}\'>${ruleColor.capitalize()}</font>`).listen()
	}
	colorFolder.add(settings.range, atomColor, 1, maxRange, 5).name('Radius').listen()
    }

    // Export
    const exportFolder = gui.addFolder('Export')
    exportFolder.add(settings.export, 'image').name('Image')
    exportFolder.add(settings.export, 'video').name('Video: Start / Stop')
    exportFolder.add(settings.export, 'data').name('Data')
}


/*** PRNG ***/

// Pseudorandom number generator
// stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function mulberry32prng(seed) {
    return function() {
	var t = seed += 0x6D2B79F5;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getSeedFromUrlFragment() { 
    let hash = window.location.hash;  // fragment identifier of the URL
    if (hash != undefined && hash[0] == '#') {
	let urlfi = Number(hash.substr(1)); // remove the leading '#'
	if (isFinite(urlfi)) {
	    settings.seed = urlfi;
	    console.log("Using from the URL fragment the seed " + settings.seed);
	}
    }
}

// Random integer: the maximum and minimum are inclusive
const randint = (min, max) => Math.floor(Math.random() * (max + 1 - min) + min);


/*** UTILS ***/

const equalSets = (x, y) => {
    xs = new Set(x); ys = new Set(y);
    return xs.size === ys.size && [...xs].every((xs) => ys.has(xs));
}
const subtractSets = (a, b) => {
    bs = new Set(b);
    return a.filter(item => !bs.has(item));
}
const intersectSets = (a, b) => {
    as = new Set(b);
    bs = new Set(a);
    return [...as].filter(item => bs.has(item));
}
const equalArrays = (x, y) => x.length === y.length && x.every((val, ind) => val === y[ind]);
const equalMultisets = (x, y) => {
    x.sort((a, b) => a - b); y.sort((a, b) => a - b);
    return equalArrays(x, y);
}

function filterOutRepeats(C) {
    const onlyUnique = (value, index, array) => array.indexOf(value) === index;
    for (let i=0; i < C.length; i++) C = C.filter(onlyUnique);
    return C;
}

const argmax = a => a.reduce((accum, val, ind, arr) => val > arr[accum] ? ind : accum, 0);
const argmax12 = (a) => {
    let first = -Infinity, second = -Infinity, i1, i2;
    for (let i = 0; i < a.length; i++) {
	if (a[i] > first) {
	    [second, first] = [first, a[i]];     // save previous max
	    [i2, i1] = [i1, i];		    
	} else if (a[i] < first && a[i] > second) {
	    second = a[i];                  // new second biggest
	    i2 = i;
	}
    }
    return [[first, second], [i1, i2]];
}
const sumArray = a => {return a.length > 1 ? a.reduce((acc, val) => acc + val, 0) : a[0]};
const zipTwoArrays = (a, b) => a.map((val, ind) => [val, b[ind]]);
const zipSumTwoArrays = (a, b) => a.map((val, ind) => val + b[ind]);

function matMult(a, b) {
    var aNumRows = a.length, aNumCols = a[0].length, bNumRows = b.length, bNumCols = b[0].length, m = new Array(aNumRows);  // initialize array of rows
    for (var r = 0; r < aNumRows; ++r) {
	m[r] = new Array(bNumCols); // initialize the current row
	for (var c = 0; c < bNumCols; ++c) {
	    m[r][c] = 0;             // initialize the current cell
	    for (var i = 0; i < aNumCols; ++i) 
		m[r][c] += a[r][i] * b[i][c];
	}
    }
    return m;
}
function matDisp(m) {
    for (var r = 0; r < m.length; ++r) 
	document.write('&nbsp;&nbsp;'+m[r].join(' ')+'<br />');
}
function mahalanobisInnerProd(x, C, y) {
    // negative log-likelihood
    if (y === undefined) y = x; //math.transpose(x);
    const P = math.inv(C);
    return 1/2 * math.multiply(y, P, x); // math.dot(y, math.multiply(P, x)); 
}

function nlgc(C) { // negative log-Gaussian function constant term, like variational Laplace mode prior
    // C: Gaussian covariance
    return 1/2 * math.log(math.det(math.multiply(2*math.pi, C)));

}

/*** ATOMS AND FORCES ***/    

// atom = [x, y, vx, vy, hsl, id]

// Initiate random locations for atoms 
function randomX() {return mb32closure() * (canv.width - 100) + 50;}
function randomY() {return mb32closure() * (canv.height - 100) + 50;}
function createAtoms(n) {
    for (let i = 0; i < settings.colors.length; i++) 
	for (let j = 0; j < n; j++) 
	    atoms.push([randomX(), randomY(), 0, 0, rgb2hsl(...colstr2rgb(settings.colors[i])), [i]]);
};

function restartAtoms(numPerColor, erase_past = true) {
    if (erase_past) {
	atoms.length = 0;
	clusters.length = 0;  entities.length = 0; 
	starttime = Date.now();
    }
    createAtoms(numPerColor);
    clusters[0] = atoms;	    
    clusters.push([spawnCluster()]); // initialize top/universe cluster
    nsplits = nmerges = 0;
    findAtomicEntities();
}

function randomInteractions() {
    for (const i of settings.colors) {
	settings.interactionCoefficients[i] = {};
	for (const j of settings.colors) settings.interactionCoefficients[i][j] = mb32closure() * 2 - 1; // range [-1 1]
	settings.range[i] = interactionRange;
    }
    if (!isFinite(settings.seed)) settings.seed = 0xcafecafe;
    window.location.hash = "#" + settings.seed;
    document.title = "Racemi2D #" + settings.seed;
    console.log("Seed=" + settings.seed);
    console.log(JSON.stringify(settings.interactionCoefficients));
}

function symmetrizeInteractions() {
    for (const i of settings.colors) 
	for (const j of settings.colors) 
	    if (j < i) {
		let v = 0.5 * (settings.interactionCoefficients[i][j] + settings.interactionCoefficients[j][i]);
		settings.interactionCoefficients[i][j] = settings.interactionCoefficients[j][i] = v;
	    }
    console.log(JSON.stringify(settings.interactionCoefficients));
}
function skewsymmetrizeInteractions() {
    for (const i of settings.colors) 
	for (const j of settings.colors) 
	    if (j <= i) {
		let v = 0.5 * (settings.interactionCoefficients[i][j] - settings.interactionCoefficients[j][i]);
		settings.interactionCoefficients[i][j] = v;
		settings.interactionCoefficients[j][i] = -v;
	    }
    console.log(JSON.stringify(settings.interactionCoefficients));
}

function resetWorld() {
    randomInteractions();
    restartAtoms(settings.atoms.count, true);
    updateGuiDisplay();
}

function setColors() {
    settings.colors = [];
    for (let i = 0; i < settings.numColors; ++i) settings.colors.push(palette[i]);
}

function roamParamspace() {
    if (exploration_timer <= 0) {
	let c1 = settings.colors[Math.floor(mb32closure() * settings.numColors)]; //random color 1
	if (mb32closure() >= 0.2) {  // 80% chance of changing the strength
	    let c2 = settings.colors[Math.floor(mb32closure() * settings.numColors)];
	    let new_strength = mb32closure();
	    if (settings.interactionCoefficients[c1][c2] > 0) new_strength *= -1; // enforce anti-signed interactions for appeal
	    settings.interactionCoefficients[c1][c2] = new_strength;
	} else {                     // 20% for the range
	    settings.range[c1] = 1 + Math.floor(mb32closure() * maxRange);
	}
	exploration_timer = settings.explorationPeriod; // in frames, so in seconds it's EP/FPS ~ 100/20 = 5
    } else exploration_timer -= 1;
}


 /*** DISPLAY AND DRAWING ***/   

function updateCanvas() {
    canv.width = window.innerWidth * settings.cw;
    canv.height = window.innerHeight * settings.ch;
    crc.fillStyle = settings.drawings.background_color;  
    crc.fillRect(0, 0, canv.width, canv.height); // bg color
}

function colstr2rgb(str) {
    const a = document.createElement('div');
    a.style.color = str;
    const colors = window.getComputedStyle( document.body.appendChild(a) ).color.match(/\d+/g).map(function(a){ return parseInt(a,10); });
    document.body.removeChild(a);
    return (colors.length>=3) ? colors : false;
};
function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0, s = 0, l = 0;
    // hue
    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else                h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    // lightness
    const l1 = (cmax + cmin) / 2;  
    l = +(l1 * 100).toFixed(1);
    // saturation
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l1 - 1)); 
    s = +(s * 100).toFixed(1);
    return [h, s, l] 
}	
hsl2str = (h,s,l) => "hsl(" + h + "," + s + "%," + l + "%)";

hslColor = (h, s, l, a = 1) => {`hsl(${h},${s}%,${l}%,${a})`};

// Draw a square
const drawSquare = (x, y, radius, color) => {
    crc.fillStyle = color;
    crc.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
}

// Draw an ellipse
function drawEllipse(x, y, r, color, fill = true, lw = 1, dash = [false, 10, 10]) {
    crc.lineWidth = lw;	    
    crc.beginPath();
    if (dash[0]) crc.setLineDash(dash.slice(1,3)); 
    if (typeof r == "number" || r.length < 3) 
	crc.arc(x, y, r, 0, 2 * Math.PI);  // x, y, radius, ArcStart, ArcEnd
    else if (r.constructor === Array) {
	[sma1, sma2, tanphi] = r;
	crc.ellipse(x, y, sma1, sma2, Math.atan(tanphi), 0, 2*Math.PI); // sma correspond to ellipse radii
    }
    //crc.closePath();
    crc.strokeStyle = color;
    crc.fillStyle = color;
    fill ? crc.fill() : crc.stroke()
};

// Draw line between atoms
function drawInteraction(ax, ay, bx, by, color) {
    crc.beginPath();
    crc.moveTo(ax, ay);
    crc.lineTo(bx, by);
    crc.closePath();
    crc.strokeStyle = color;
    crc.stroke();
};


/*** CLUSTERS ***/    

// clusters:     [position-x, position-y, sma1, sma2, hslcolor, members, memb2cntr_sqdis, entid]
// Voronoi cell: [count, accum-x, accum-y, accum-d^2, accum-hslcolor, members, member_sqdis]

function spawnCluster(x = randomX(), y = randomY(), sma1 = maxRange, sma2, tanphi = 0, hslcolor, M = [], Msu = [undefined], ei) {
    if (sma2 === undefined) sma2 = sma1;
    if (hslcolor === undefined) hslcolor = rgb2hsl(...colstr2rgb('white')); 
    if (sphericalVar == true)
	return [x, y, sma1, undefined, hslcolor, M, Msu, ei];
    else
	return [x, y, sma1, [sma2, tanphi], hslcolor, M, Msu, ei];
}
function breedCluster(l, x, y, M, sma1 = settings.atoms.radius, sma2 = settings.atoms.radius, tanphi = 0, Msu) {
    const C = spawnCluster(x, y, sma1, sma2, tanphi, undefined, M, Msu); 
    clusters[l].push(C);		
    return clusters[l].length - 1;
}
function killCluster(l, ci) {
    clusters[l][ci] = ["tomb"]; 
}
function graftIntoParentCluster(l, ci, pi, mip) {
    let P = clusters[l+1][pi];
    //if (P[5].includes(ci)) debugger
    P[5].push(ci);
    P[6].push(mip);
}
function pruneParentCluster(l, ci, pi) {		    
    if (pi === undefined) pi = findParentClusterId(l, ci);
    else if (pi !== findParentClusterId(l, ci)) debugger;

    if (pi !== false) {
	let P = clusters[l+1][pi];
	const pci = P[5].indexOf(ci);
	//if (pci == -1) debugger 

	P[5].splice(pci, 1);
	P[6].splice(pci, 1);
    } else debugger;
    return pi;
}
function findParentClusterId(l, ci) {
    if (l < topLiveClusLev() && clusters[l+1].length > 0) {
	for (let i = 0; i < clusters[l+1].length; i++)
	    if (isClusLive(l+1, i) && clusters[l+1][i][5].includes(ci)) return i;
	return false;
    } else return false;
}
function isClusLive(l, ci) {
    return clusters[l][ci].length > 1;
}
function findLiveClusterEntityIds(ci, l, ents = entities) { // find all level l entities with cluster ci
    let ei = [];		    
    for (let i = 0; i < ents[l].length; i++) 
	if (ents[l][i][1].includes(ci) && ents[l][i][3][ents[l][i][1].lastIndexOf(ci)]==0) 
	    ei.push(i);
    return ei;
}
function getMemberCoordinates(l, C) {
    const nm = C.length;
    const Bl = clusters[l-1]; // cluster level below
    let X = [], Y = [], barycenter = [0, 0];
    for (let m of C) {
	X.push(Bl[m][0]); Y.push(Bl[m][1]);
	barycenter[0] += Bl[m][0]; barycenter[1] += Bl[m][1];
    } barycenter[0] /= nm; barycenter[1] /= nm;
    return [[X, Y], barycenter]; 
}
function computeSumsrp(l, M, V, barycenter, d) {
    const Bl = clusters[l-1];
    const nm = M.length;
    let ssu = 0, msu = [];
    if (barycenter === undefined) {
	barycenter = [0, 0];
	for (let m of M) {
	    barycenter[0] += Bl[m][0]; barycenter[1] += Bl[m][1];
	} barycenter[0] /= nm; barycenter[1] /= nm;
    }
    for (let m of M) {
	let su;
	if (V === undefined)  // spherical covariance
	    switch (d) {
		case 2:
		    su = (Bl[m][0] - barycenter[0])**2 + (Bl[m][1] - barycenter[1])**2;
		    // add neglog of normalization constant
		    su += nd/2 * math.log(2*math.pi);
		    break;
		case false:
		    break;  // skip ssu computation
		default:
		    su = Math.abs(Bl[m][0] - barycenter[0])**d + Math.abs(Bl[m][1] - barycenter[1])**d;
					debugger
	    }
	else {
	    su = mahalanobisInnerProd([Bl[m][0] - barycenter[0], Bl[m][1] - barycenter[1]], V);
	    // add neglog of normalization constant
	    su += nlgc(V);
	}
	ssu += su;
	msu.push(su);
    }
    return [ssu, barycenter, msu];
}
function getStdFromArray(v, o) {
    let sd = 0;
    ne = v[0].length;
    for (let i = 0; i < ne; i++)
	sd += (v[0][i] - o[0])**2 + (v[1][i] - o[1])**2;
    return Math.sqrt(sd / ne);
}


/*** BISECT-UNITE ***/

function trySplitting1ClusterGreedily(l) { // Similar to bisecting k-means
    const cl = clusters[l];
    let ci0, C, pi, P;
    
    // randomly pick ci0
    do ci0 = randint(0, cl.length-1); while (!isClusLive(l, ci0)); 
    C = cl[ci0];
    const nm = C[5].length; 
    if (nm < 2 * minClusMembCount) return false;

    // randomly partition C: n-subset of C, with 2 <= n <= Csize-2
    const n = randint(2, nm-2);  // disallow clusters of size less than 2
    let mi = [];
    let H1 = [], H2 = []
    while (H1.length != n) {
       const ri = randint(0, nm-1);
       for (var j = 0; j < mi.length; j++) if (mi[j] == ri) break;
       if (j == mi.length) {mi.push(ri); H1.push(C[5][ri]);}
    }
    H2 = subtractSets(C[5], H1);

    // compute sum of intercluster squared/mahalanobis distances
    const V0 = rebuildCovmat(C);  // V0 = [[1, 0], [0, 1]]; 
    let V1, V2, majsv1, majsv2, minsv1, minsv2, tanphi1, tanphi2, sma1, sma2;
    const [X1, bc1] = getMemberCoordinates(l, H1); 
    const [X2, bc2] = getMemberCoordinates(l, H2); 
    if (!sphericalVar) {				  
	[majsv1, minsv1, tanphi1, D1] = svd(X1, bc1).slice(0, 4);
	[majsv2, minsv2, tanphi2, D2] = svd(X2, bc2).slice(0, 4);
	//   M = U * S * Vt,  (V is transposed);    Mt * M = V * St*S * Vt
	V1 = math.multiply(D1.v, math.diag([majsv1**2, minsv1**2]), math.transpose(D1.v)); // var-cov matrices hold squared distances
	V2 = math.multiply(D2.v, math.diag([majsv2**2, minsv2**2]), math.transpose(D2.v));
    } else {
	sma1 = getStdFromArray(X1, bc1);    sma2 = getStdFromArray(X2, bc2);
	V1 = math.diag([sma1**2, sma1**2]); V2 = math.diag([sma2**2, sma2**2]);
    }
    let [ssd0, bc0] = computeSumsrp(l, C[5], V0); // C[6].reduce((a,b)=>a+b,0);
    let [ssd1, msu1] = computeSumsrp(l, H1, V1, bc1).toSpliced(1, 1);
    let [ssd2, msu2] = computeSumsrp(l, H2, V2, bc2).toSpliced(1, 1); 

    if (l < topLiveClusLev()) {       
	pi = findParentClusterId(l, ci0);   
	//if (pi === false) debugger;
	P = clusters[l+1][pi]; 
    } else if (l == topLiveClusLev()) { // there should be only one top cluster:   && (clusters[l].length == 1)  
	// potential new top cluster for l+1
	const XP = math.transpose([bc1, bc2]); 
	const bcP = math.mean([bc1, bc2], 0);
       if (!sphericalVar) {
	    [majsvP, minsvP, tanphiP, DP] = svd(XP, bcP).slice(0, 4);
	    P = spawnCluster(x = bcP[0], y = bcP[1], sma1 = majsvP, sma2 = minsvP, tanphi = tanphiP); 
	} else {
	    sma = getStdFromArray(XP, bcP);
	    P = spawnCluster(x = bcP[0], y = bcP[1], sma1 = sma); 
	}
    }

    // compute sum of inter-centroid Mahalanobis squared distances
    const VP = rebuildCovmat(P);  
    ssd0 += mahalanobisInnerProd([C[0] - P[0], C[1] - P[1]], VP);  // 0 if new top cluster 
    const mip1 = mahalanobisInnerProd([bc1[0] - P[0], bc1[1] - P[1]], VP); 
    const mip2 = mahalanobisInnerProd([bc2[0] - P[0], bc2[1] - P[1]], VP); 
    ssd1 += mip1; 
    ssd2 += mip2;
    // add neglog of normalization constant
    ssd0 += nlgc(VP); 
    ssd1 += nlgc(VP); ssd2 += nlgc(VP);

    if (ssd1 + ssd2 < ssd0) {     // splitting               
	// kill formerly united cluster and prune its parent
	killCluster(l, ci0); 	  

	// add to entities array and create 2 new clusters
	let ci1, ci2;
	if (!sphericalVar) {
	    ci1 = breedCluster(l, bc1[0], bc1[1], H1, majsv1, minsv1, tanphi1, Msu = msu1);
	    ci2 = breedCluster(l, bc2[0], bc2[1], H2, majsv2, minsv2, tanphi2, Msu = msu2);
	} else {
	    ci1 = breedCluster(l, bc1[0], bc1[1], H1, sma1, sma1, Msu = msu1);
	    ci2 = breedCluster(l, bc2[0], bc2[1], H2, sma2, sma2, Msu = msu2);
	}

	// prune 1 and graft 2 members
	if (l < topLiveClusLev()) {       
	    pruneParentCluster(l, ci0, pi);
	    graftIntoParentCluster(l, ci1, pi, mip1);
	    graftIntoParentCluster(l, ci2, pi, mip2);

	} else if (l == topLiveClusLev()) {   
	    // stack a new l+1-topcluster after splitting old l-topclus
	    P[5] = [ci1, ci2];  // graft splits into new parent cluster
	    P[6] = [mip1, mip2];
	    // create new top layer
	    if (clusters.length - 1 == topLiveClusLev()) // the top level l holds one live clus; no dead top level
		clusters.push([]);  // hence if we split it we need to tack a level on the dendron
	    clusters[l+1].push(P); 
	}

	console.log(`split ${++nsplits}`);

	return [[H1, H2], [ssd1, ssd2]]; 
    } else     //  no splitting
	return [[C[5]], [ssd0]];
}

function tryMerging2ClustersGreedily(l) {
    if (l == topLiveClusLev()) return false;     
			    
    const Cl = clusters[l]; 
    const nc = Cl.length;
    const Al = clusters[l+1]; // cluster layer above

    // pick two arbitrary distinct clusters with common cluster parent
    let ci1, pi1, ci2, pi2;
    if (l == topLiveClusLev()-1) { // last to top cluster layer: only one cluster parent 
	// kill parent cluster if it's top and has no other children
	if (numClus()[0][l] == 1) { 
	    do ci1 = randint(0, nc-1); while (!isClusLive(l, ci1));    
	    pi1 = findParentClusterId(l, ci1); 
	    killCluster(l+1, pi1); 
	    //clusters.pop(); // maybe simply pop

	    console.log("top cluster removed");

	    return [[false], [false]];
	}

	do {
	    ci1 = randint(0, nc-1);            ci2 = randint(0, nc-1); 
	    pi1 = findParentClusterId(l, ci1); pi2 = findParentClusterId(l, ci2);
	} while (ci2 == ci1 || Cl[ci1].length == 1 || Cl[ci2].length == 1); 

	if (pi1 != pi2) debugger;
			
    } else {
	if (numClus()[0][l] == 1) return false; // only one live cluster at level l 

	// pick one cluster parent from the supraordinate layer
	do pi1 = randint(0, Al.length-1); while (Al[pi1].length < 2);
	const P = Al[pi1];   
	const nm = P[5].length;

	if (nm >= 2) {
	    pi2 = pi1;
	    do {
		ci1 = P[5][randint(0, nm-1)];     ci2 = P[5][randint(0, nm-1)]; 
	    } while (ci2 == ci1 || !isClusLive(l, ci1) || !isClusLive(l, ci2)); 
	} else {  // nm==1
	    // deprecated: do not merge if there are 2 or less siblings: this hinders a level 1 universal gigacluster
	    // if (nm <= minClusMembCount) return false;

	    // trying to merge a monocluster with other cluster
	    ci1 = P[5][0];
	    do pi2 = randint(0, Al.length-1); while (!isClusLive(l+1, pi2) || pi2 == pi1); 
	    const P2 = Al[pi2];   
	    const nm2 = P2[5].length;
	    do ci2 = P2[5][randint(0, nm2 - 1)]; while (!isClusLive(l, ci2));  
	}
    }

    // common parent
    const P = Al[pi1];   
    const P2 = Al[pi2]; // usually P==P2 except if P is a monocluster   

    // define subclusters
    const C1 = Cl[ci1][5];
    const C2 = Cl[ci2][5];
    const C3 = C1.concat(C2); // there should be no repeats: filterOutRepeats([...C1, ...C2])
    //for (let m of C1) if (C2.includes(m)) debugger;

    // compute sum of squared/mahalanobis distances
    const V1 = rebuildCovmat(Cl[ci1]);  // V1 = [[1, 0], [0, 1]];
    const V2 = rebuildCovmat(Cl[ci2]); 
    const [X3, bc3] = getMemberCoordinates(l, C3); 
    let sv1, sv2, tanphi, V3, sma;
    if (!sphericalVar) {
	[sv1, sv2, tanphi, D3] = svd(X3, bc3).slice(0, 4);
	V3 = math.multiply(D3.v, math.diag([sv1**2, sv2**2]), math.transpose(D3.v));
    } else {
	sma = getStdFromArray(X3, bc3);    
	V3 = math.diag([sma**2, sma**2]); 
    }
    let [ssd1, bc1] = computeSumsrp(l, C1, V1);
    let [ssd2, bc2] = computeSumsrp(l, C2, V2);
    let [ssd3, msu3] = computeSumsrp(l, C3, V3).toSpliced(1, 1); 

    // compute sum of inter-centroid squared/mahalanobis distances
    const VP = rebuildCovmat(P);  
    const VP2 = rebuildCovmat(P2);  
    ssd1 += mahalanobisInnerProd([bc1[0] - P[0], bc1[1] - P[1]], VP); 
    ssd2 += mahalanobisInnerProd([bc2[0] - P2[0], bc2[1] - P2[1]], VP2); // VP2=VP if pi1=pi2
    // add neglog of normalization constant
    ssd1 += nlgc(VP); ssd2 += nlgc(VP2); 
    // merged clus
    let mip3; 
    // same for second parent P2 unlike P1==P, when P has a single child
    if (l < topLiveClusLev()-1 && P[5].length==1) { // two parents, at least one with single child
	// use P2 as new common parent: simply pick P2's centroids if P has a single child. even if P2 has also only one
	mip3 = mahalanobisInnerProd([bc3[0] - P2[0], bc3[1] - P2[1]], VP2); 
	ssd3 += nlgc(VP2);
    } else {  // one common parent
	mip3 = mahalanobisInnerProd([bc3[0] - P[0], bc3[1] - P[1]], VP); 
	ssd3 += nlgc(VP);
    }
    ssd3 += mip3;

    //console.log(math.round(ssd3), math.round(ssd2), math.round(ssd1),C1.length+C2.length, C3.length, math.round(nlgc(VP)+nlgc(VP2)+mip3))
    if (ssd3 < ssd1 + ssd2) {
	// kill former halves and prune parents
	killCluster(l, ci1); 
	killCluster(l, ci2);	       
	pruneParentCluster(l, ci1, pi1); // if pi1 had a single child, now it's childless, and will be killed by ekm 
	pruneParentCluster(l, ci2, pi2);

	// create new union and graft new children into it 
	let ci3;
	if (!sphericalVar)
	    ci3 = breedCluster(l, bc3[0], bc3[1], C3, sv1, sv2, tanphi, Msu = msu3);
	else
	    ci3 = breedCluster(l, bc3[0], bc3[1], C3, sma, Msu = msu3);
	    
	if (l < topLiveClusLev()-1 && P[5].length==1) {  // two parents, at least one with single child
	   graftIntoParentCluster(l, ci3, pi2, mip3);
	} else {  // one common parent
	   graftIntoParentCluster(l, ci3, pi1, mip3);
	}

	console.log(`merge ${++nmerges}`);

	return [[C3], [ssd3]];
    } else
	return [[C1, C2], [ssd1, ssd2]]; 

}
function splitMergeClusters() {
    const N = settings.maxNumLiveClusters;
    let lsl = clusters.length; // lowest split level
    let lml = clusters.length; // lowest merge level
    for (let l = 1; l <= topLiveClusLev(); l++) {
	let sc, mc;

	if (numClus()[2] < N) {    
	    sc = trySplitting1ClusterGreedily(l);
	    if (sc != false && sc[0].length == 2 && l < lsl) lsl = l; 
	}

	mc = tryMerging2ClustersGreedily(l);
	if (mc != false && mc[0].length == 1 && l < lml) lml = l; 
	if (l == topLiveClusLev() && clusters[l].length == 1) break; 

	//ri1 = randint(0, clusters[l].length-1), ri2 = randint(0, clusters[l].length-1);
	//if (ri1 != ri2 && clusters[l][ri1].length>1 && clusters[l][ri2].length>1 && intersectSets(clusters[l][ri1][5], clusters[l][ri2][5]).length > 0 ) debugger;
    }
    const isSplitMerge = (lsl < clusters.length || lml < clusters.length) ? true : false;		    
    return [isSplitMerge, lsl, lml]
}


/*** EM-ALGORITHM: ELLIPTICAL K-MEANS ***/

function MstepTranslocation(l) {
    for (let i = 0; i < clusters[l].length; ++i) {
	if (!isClusLive(l, i)) continue;
	const c = clusters[l][i];
	const nm = c[5].length;
	if (nm < 1) //minClusMembCount) 
	    continue;

	const bc = computeSumsrp(l, c[5], d = false)[1];
	c[0] = bc[0]; c[1] = bc[1];
    }
}

function ekmMstepVoronoiTranslocateReshape(VC, l) {
    let dss = 0;   // sum of surprisal change
    let isRealloc = false;
    for (let i = 0; i < clusters[l].length; ++i) {
	if (!isClusLive(l, i)) continue;
	const c = clusters[l][i];
	const nnc = VC[i][2].length;
	if (nnc > 0) { // if cluster is not childless
	    // translocate
	    const new_x = sumArray(VC[i][0]) / nnc, new_y = sumArray(VC[i][1]) / nnc;
	    c[0] = new_x; c[1] = new_y;

	    // reshape
	    if (c[3] !== undefined) {
		if (nnc > 1)
		    [new_sma1, new_sma2, new_tanphi, D, ind] = svd(VC[i], c);
		else {
		    new_sma1 = settings.atoms.radius;           
		    new_sma2 = settings.atoms.radius;          
		    new_tanphi = 0;           
		}
		// exponential smoothing: important for stability
		c[2]    = (1-w) * c[2]    + w * new_sma1;           
		c[3][0] = (1-w) * c[3][0] + w * new_sma2;          
		c[3][1] = (1-w) * c[3][1] + w * new_tanphi;           
	    } else {
		const new_sma1 = getStdFromArray(VC[i], [new_x, new_y]);
		c[2] = (1-w) * c[2] + w * new_sma1;  // reshape: exponential smoothing
	    }

	    // reallocate and recompute member surprisals
	    if (!equalMultisets(c[5], VC[i][2])) { // if cluster members have changed
		isRealloc = true;
		c[5] = VC[i][2]; 
	    }
	    V = rebuildCovmat(c); // because of reshape smoothing 
	    new_msu = recomputeMemberSurp(l, i, V);  
	    dss += sumArray(new_msu) - sumArray(c[6]);
	    c[6] = new_msu;  
	} else { // if cluster is childless
	    c[5] = [];
	}

    }
    return [dss, isRealloc];
}
function svd(X, bc) {
    // the non-zero elements of S (singular values) are the square roots of the non-zero eigenvalues of M⁎M or MM⁎
    //   M = U * S * Vt,  (V is transposed);    Mt * M = V * St*S * Vt
    const nrows = X[0].length;
    const M = zipTwoArrays(X[0].map(v => (v - bc[0])/Math.sqrt(nrows-1)), X[1].map(v => (v - bc[1])/Math.sqrt(nrows-1))); //m children, n dim: mx 2
    const D = SVDJS.SVD(M);  // github.com/danilosalvati/svd-js               // also math.eigs
    let [[majorsv, minorsv], [i1, i2]] = argmax12(D.q);			    
    const new_tanphi = D.v[1][i1]/D.v[0][i1]; // first rightsingvec: the right singular vectors are in V's columns

    // two-point clusters yield singular covariance matrices: eschew by setting a positive minimum sma
    if (X[0].length == 2) {
	if (D.q.includes(NaN)) {
	    i1 = 0; i2 = 1; 
	    majorsv = D.q[i1] = sumArray(math.diag(M).map(v => math.abs(v))); 
	    minorsv = D.q[i2] = 0;
	}
	minorsv = D.q[i2] = Math.max(settings.atoms.radius, D.q[i2]);
    }
    //if (!isFinite(majorsv) || !isFinite(minorsv)) debugger

    return [majorsv, minorsv, new_tanphi, D, [i1, i2]];
}

function ekmColorMstepKill(VC, l) {
    let isKill = false;
    for (let i = 0; i < clusters[l].length; i++) {
	if (!isClusLive(l, i)) continue;  // if cluster dead
	const c = clusters[l][i];
			
	if (VC[i][2].length >= minClusMembCount) {  //  the cluster remains non-degenerate 

	    // drawing parameters
	    let hue; 
	    const pi = findParentClusterId(l, i);
	    if (l == topLiveClusLev() || pi === false) hue = 360 * mb32closure();
	    else                                       hue = clusters[l+1][pi][4][0];
	    let saturation, oldestEntObjLifespan, e, ei, newreg;
	    if (c[7] !== undefined && entities[l].length > 0 && entities[l][c[7]][1].includes(i)) { // if cluster points to its parentity 
		e = entities[l][c[7]];  // parent entity
		oldestEntObjLifespan = e[2][e[1].indexOf(i)]; // instead of lastIndexOf
		saturation = 100 * (Date.now() - oldestEntObjLifespan) / (Date.now() - starttime); 
	    } else saturation = 100 * mb32closure();
	    const lightness = 100 * 1/2;
	    c[4][0] = (1-w) * c[4][0] + w * hue;          
	    c[4][1] = (1-w) * c[4][1] + w * saturation;          
	    c[4][2] = (1-w) * c[4][2] + w * lightness;          
			    
	} else {   // if degenerate: kill or recreate degenerate cluster

	    if (VC[i][2].length == 1) {  //  the cluster has a single child
		// single-child clusters don't collapse because they are moving
		c[2]        = (1-w) * c[2] + w * settings.atoms.radius;           
		if (c[3] !== undefined) {
		    c[3][0] = (1-w) * c[3][0] + w * settings.atoms.radius;          
		    c[3][1] = (1-w) * c[3][1] + w * 0;
		} 		            	
		c[5] = VC[i][2];
		c[6] = VC[i][3];
	    } else if (VC[i][2].length == 0) {
		killCluster(l, i);   // kill and make tomb only if cluster is not top and there are at least two live clusters in level l
		pruneParentCluster(l, i);

		isKill = true;
		console.log(`cluster ${i} of level ${l} died`);
	    }
	}
    }  
    return isKill;
}
function recomputeMemberSurp(l, ci, V) {
    let ms = [];
    const c = clusters[l][ci];
    if (V === undefined) V = rebuildCovmat(c);  
    for (const m of c[5]) {
	const x = clusters[l-1][m][0], y = clusters[l-1][m][1];
	const dx = x - c[0],           dy = y - c[1];
	let su = mahalanobisInnerProd([dx, dy], V); // surprisal or Shannon information
	su += nlgc(V); 
	ms.push(su)
    }
    return ms;
}
function rebuildCovmat(c) {
    if (c[3] === undefined)  // spherical model
	return math.diag([c[2]**2, c[2]**2]); 

    const phi = math.atan(c[3][1]);		// in radians
    // rotation matrix: from zero to major axis orientation		
    const R = [[math.cos(phi), -math.sin(phi)], [math.sin(phi), math.cos(phi)]]; 

    //   M = U * S * Vt,  (V is transposed);    Mt * M = V * St*S * Vt
    const V = R;  // this is the rotation from sv space to covmatrix space
    const S = math.diag([c[2], c[3][0]]);

    return math.multiply(V, S, S, math.transpose(V)); // ellipse axes length is square root of covariance 
}
function findNearestCentroid(x, y, l) {
    let ncid = -1, ncsu = 1e38;
    for (let i = 0; i < clusters[l].length; ++i) {
	if (!isClusLive(l,i)) continue;
	const dx = x - clusters[l][i][0], dy = y - clusters[l][i][1];
	const V = rebuildCovmat(clusters[l][i]);  
	let su = mahalanobisInnerProd([dx, dy], V); // surprisal or Shannon information
	su += nlgc(V); 
	if (su < ncsu) {
	    ncid = i;
	    ncsu = su;
	}
    }
    return [ncid, ncsu];
}

function ellipticalKmeans(l) {
    MstepTranslocation(l);
    let isRealloc = false;
    const maxnit = 100;
    const VC = new Array(clusters[l].length).fill([[], [], [], []]); // Voronoi cells
    // E-step
    for (var it = 0; it < maxnit; ++it) {
	for (let j=0; j < clusters[l].length; ++j) VC[j] = [[], [], [], []];
	for (let i=0; i < clusters[l-1].length; i++) {
	    if (!isClusLive(l-1, i)) continue;
	    let c = clusters[l-1][i];
	    let [nci, ncsu] = findNearestCentroid(c[0], c[1], l);
     //if (nci == -1 || ncsu > maxRange**2) debugger;
	    
 	    VC[nci][0].push(c[0]); VC[nci][1].push(c[1]);
            VC[nci][2].push(i);
            VC[nci][3].push(ncsu);
        }
	const [dss, isrl] = ekmMstepVoronoiTranslocateReshape(VC, l);
	isRealloc ||= isrl;

	//console.log(dss) //if (msd < 1) break;
	if (Math.abs(dss) < .1) {  // && dss < 0
	    console.log(`break EM loop; it = ${it}, dss = ${dss.toFixed(2)}`); 
	    break;
	} 
    }
    if (it == maxnit-1) console.log(`EM loop end (level ${l})`);

    const isKill = ekmColorMstepKill(VC, l);

    return (isRealloc || isKill);
}    

function trackClusters() {

    let lrkl = clusters.length - 1, isReallocOrKill = false, isSplitMerge = false, lsl, lml;
    // allocate atoms to clusters[1]: kmeans(atoms, clusters[1]);
    // allocate clusters[i] to clusters[i+1]
    for (let l = 1; l <= topLiveClusLev(); l++) {
	const isrk = ellipticalKmeans(l);
	if (isrk && l < lrkl) lrkl = l;
	isReallocOrKill ||= isrk;
    }

    [isSplitMerge, lsl, lml] = splitMergeClusters();

    return [(isReallocOrKill || isSplitMerge), Math.min(lrkl, lsl, lml)]; 		    
}

function drawClusters(l) {
    let i = 0;
    while (i < clusters[l].length) { // clus.length is evaluated only once, at the start of the loop 
	let c = clusters[l][i];
	if (isClusLive(l, i)) {  // && c[2]>0
	    color = hsl2str(...c[4]);
	    let lg;
	    if (c[3] == undefined) {
		lg = Math.PI * c[2] / c[5].length;
		drawEllipse(c[0], c[1], c[2], color, false, 2*l, [true, lg, lg]);
	    } else {
		lg = Math.PI * Math.sqrt(c[2]**2+c[3][0]**2) / c[5].length;
		drawEllipse(c[0], c[1], [c[2], ...c[3]], color, false, 2*l, [true, lg, lg]);
	    }
	} 
	++i; 
    }
}


/*** ENTITIES ***/

// entities[l][i]: member ids, live cluster ids, birthtime, lifespan 	

function transcribeClusToEntMultiset(l, ci, ents = entities) {
    if (l == 0) return [clusters[l][ci][7]];

    let mulset = [];
    for (let mi of clusters[l][ci][5])
	for (let k = 0; k < ents[l-1].length; k++)
	    if (ents[l-1][k][1].includes(mi) && ents[l-1][k][3][ents[l-1][k][1].lastIndexOf(mi)] == 0) {
		// entity pointers to live clusters (and viceversa) at l-1 are correct 
		//because of the bottom-up sweep of scanUpdateEntities
		mulset.push(k); 

		// but can other pointers at l-1 wrongly point after the bu sweep?
		const ems = transcribeClusToEntMultiset(l-1, mi);
		if (clusters[l-1][mi][7] != k || !equalMultisets(ents[l-1][k][0], ems)) {
		    console.warn("mismatch: ", l, k, ents[l-1][k][0], mi, clusters[l-1][mi][5]);  
		    //debugger;
		    const e = ents[l-1][k];
		    e[3][e[1].lastIndexOf(mi)] = Date.now() - e[2][e[1].lastIndexOf(mi)]; 
		}

	    }
    if (mulset.length != clusters[l][ci][5].length) { // the entity ids do not match
	console.warn("mismatch: ", l, ci, mulset, clusters[l][ci][5]);  
	//debugger
	return false; 
    } else 
	return mulset;
}
function findAtomicEntities(ents = entities) { 
    if (ents.length == 0) ents[0] = [];
    for (let j = 0; j < settings.numColors; j++) {
	if (ents[0].length-1 < j) ents[0].push([[j], [], [], []]); 
	for (let ci = 0; ci < clusters[0].length; ci++) 
	    if (clusters[0][ci][5][0] == j && !ents[0][j][1].includes(ci)) {
		ents[0][j][1].push(ci);
		ents[0][j][2].push(Date.now());
		ents[0][j][3].push(0);
		clusters[0][ci][7] = j;
	    }
    }
    return ents;
}
function fileLiveClusInEnts(l, ci, ents = entities) { 
    // find entity with id ei in level l corresponding to cluster id ci; if absent, create entity and append
    mulset = transcribeClusToEntMultiset(l, ci);
    if (mulset === false) debugger //return [undefined, false]; // the matching entities have not been added yet

    let newreg = false;  // new ent registered ?
    for (var ei = 0; ei < ents[l].length; ei++) { // loop2:
	if (equalMultisets(mulset, ents[l][ei][0])) {      // if the multiset is already registered
	    if (!ents[l][ei][1].includes(ci) ||                                                  // cluster object not registered
		(ents[l][ei][1].includes(ci) && ents[l][ei][3][ents[l][ei][1].lastIndexOf(ci)] > 0)) {    // cluster object registered but dead
		ents[l][ei][1].push(ci);
		ents[l][ei][2].push(Date.now());
		ents[l][ei][3].push(0);
		clusters[l][ci][7] = ei;
		newreg = true;
	    }   
	    return [ei, newreg]; //break; // continue loop2;   // cluster object registered and alive
	}
    }
    if (ei == ents[l].length) {   // multiset not registered, so add it
	ents[l].push([mulset, [ci], [Date.now()], [0]]);
	clusters[l][ci][7] = ei;
	newreg = true; // new entity created: true
    } 
    return [ei, newreg]; 
}
function fileDeadClusInEnts(l, ci) { 
    for (const e of entities[l])  
	if (e[1].includes(ci) && e[3][e[1].lastIndexOf(ci)] == 0) {
	    e[3][e[1].lastIndexOf(ci)] = Date.now() - e[2][e[1].lastIndexOf(ci)];
	    return e;
	}
    return false;
}
function cullDanglingClusInEnts(l, ei) {
    const e = entities[l][ei];
    let cis = [];
    for (let ci = 0; ci < clusters[l].length; ci++)
	if (e[1].includes(ci) && e[3][e[1].lastIndexOf(ci)] == 0) {  // points to live cluster ci
	   const ems = transcribeClusToEntMultiset(l, ci);
	   if (clusters[l][ci][7] != ei || !equalMultisets(ems, e[0])) 
	       e[3][e[1].lastIndexOf(ci)] = Date.now() - e[2][e[1].lastIndexOf(ci)];
	   // return ci;  lazy culling (one per ent) not good: there can be multiple clus in each ent 
	   cis.push(ci);
	}
    return cis;  
}
function scanUpdateEnts(lesl) {  // [[]]
    const ents = entities;
   // if (clusters.length == 0) return ents;

    if (lesl == 0) findAtomicEntities();

    const l1  = Math.max(1, lesl);			    
    // discover new live and dead entities, delete dangling pointers
    // important: the sweep must be bottom-up and include dead levels for correctness
    for (let l = l1; l < clusters.length; l++) {   // clusters.length == entities.length
	if (ents.length == l) ents.push([]);
	// scan ent object for new live (new clus) and dead (clus tomb) instances
	for (let ci = 0; ci < clusters[l].length; ci++) // loop2:
	    if (isClusLive(l, ci)) {
		//if (clusters[l][ci][5].length < minClusMembCount) continue; 
		fileLiveClusInEnts(l, ci);
	    } else
		fileDeadClusInEnts(l, ci);

	// scan ent object for dangling pointers to deprecated clusters
	//  when a cluster transforms and its former entity keeps pointing
	for (let ei = 0; ei < entities[l].length; ei++)
	    cullDanglingClusInEnts(l, ei);
    }
}

function numEnts() {
    let nl = [numAtomTypes], nd = [0];
    for (l = 1; l < entities.length; l++) {	   
	nl[l] = 0; nd[l] = 0;
	for (let i = 0; i < entities[l].length; i++) {
	    if (!entities[l][i][3].includes(0)) nd[l]++;
	    else                                nl[l]++;
	}
    }
    return [nl, nd];
}	
function liveEnts() {
    let le = [];
    le.push(entities[0]);
    for (let l = 1; l < entities.length; l++) {
	le[l] = [];
	for (let ei = 0; ei < entities[l].length; ei++)
	    if (entities[l][ei][3].includes(0)) le[l].push(entities[l][ei]);
    }
    return le;
}

    

/*** PHYSICS ***/

// Enact atomic interactions
const stepForward = () => {
    const c = (settings.isViscous) ? 10 ** settings.damping : 0;
    const dt = 10 ** settings.logTimeStep;
    const n = settings.interactionLaw;
    const m = settings.atoms.mass;
    const ixs = 10 ** settings.interactionLog10scale;
    mav = 0; msv = 0;
    msvk = []; for (let i = 0; i < settings.numColors; i++) msvk.push(0);

    // update velocity 
    for (const a of atoms) {
	let Fx = 0, Fy = 0;
	const rang2 = settings.range[settings.colors[a[5]]]**2;
	for (const b of atoms) {
	    const g = ixs * settings.interactionCoefficients[settings.colors[a[5]]][settings.colors[b[5]]];
	    let dx = a[0] - b[0], dy = a[1] - b[1];
	    //if (a == b) continue;  // or don't interact with yourself
	    if (dx !== 0 || dy !== 0) {
		if (settings.wrapAround) {
		    const dxpm = [dx-canv.width, dx, dx+canv.width],   dypm = [dy-canv.height, dy, dy+canv.height];
		    const dxa = dxpm.map(Math.abs),                    dya = dypm.map(Math.abs);
		    let dxi = dxpm.indexOf(math.min(dxa)),             dyi = dypm.indexOf(math.min(dya));
		    if (dxi == -1) dxi = dxpm.indexOf(-math.min(dxa)); if (dyi == -1) dyi = dypm.indexOf(-math.min(dya));
		    //if (dxi==-1) debugger
		    dx = dxpm[dxi];	                               dy = dypm[dyi];							
		}
		const dr2 = dx ** 2 + dy ** 2;
		const dr = Math.sqrt(dr2);

		if (dr2 < rang2) {
		    // only for n close to 0 there seem to be interesting effects
		    //const F = g / dr;   // inverse law: n = -1
		    let F = g * dr ** n;    // inverse-square law: n = -2
		    
		    const ar = settings.atoms.radius;
		    if (settings.regularPotential && dr <= ar)
                    	F = g * ar ** n * dr / ar;

		    Fx += F * dx/dr; Fy += F * dy/dr;   // dr^-1 because (dx,dy) must be normalized to unit vectors

		    // draw lines between interacting atoms 
		    if (settings.drawings.forcelines) 
			drawInteraction(a[0], a[1], b[0], b[1], settings.colors[b[5]]);                            
		}
	    }
	}
	if (prod_st != 0) {
	    const dx = a[0] - prod_x, dy = a[1] - prod_y;
	    const dr2 = dx ** 2 + dy ** 2;
	    if (dr2 > 0 && dt > 0) {
		const prodForce = 100. * prod_st / (dr2 * dt);  // inverse square law
		Fx += prodForce * dx; Fy += prodForce * dy;
	    }
	}
	if (settings.wallThickness > 0) {
	  const wt = settings.wallThickness, we = settings.wallElasticity;
	  if (a[0] < wt)               Fx += (wt - a[0]) * we;
	  if (a[1] < wt)               Fy += (wt - a[1]) * we;
	  if (a[0] > canv.width - wt)  Fx += (canv.width - wt - a[0]) * we;
	  if (a[1] > canv.height - wt) Fy += (canv.height - wt - a[1]) * we;
	}

	Fy += settings.gravity * dt / m;

	// dynamic equation with damping coefficient: dv/dt = -c*v  =>  v = exp(-c*t) ~ -c*t => v1-v0 ~ -c*(t1-t0) ~ -c*dt
	//a[2] -= c * a[2] * dt; a[3] -= c * a[3] * dt;  // the damping coefficient multiplies velocity
	// dynamic equation with drag coefficient: dv/dt = -c*v^2  => v = 1/(c*t) => v1-v0 ~ 1/c*(1/t1-1/t0) = (t0-t1)/(c*t0*t1) = -dt*c*v1*v0 ~ -dt*c*v1^2
	// drag coefficient (skin friction and form drag) depends on the Reynolds number for fluids
	if (Math.abs(c*a[2]*dt) >= 1) a[2] = 0; else a[2] -= c * a[2]**2 * dt * Math.sign(a[2]) / m;
	if (Math.abs(c*a[3]*dt) >= 1) a[3] = 0; else a[3] -= c * a[3]**2 * dt * Math.sign(a[3]) / m;
	
	// dp/dt = F
	a[2] += Fx * dt / m; 
	a[3] += Fy * dt / m;

	// record mean squared velocity, to later update logTimeStep accordingly
	mav += Math.abs(a[2]) + Math.abs(a[3]);
	msv += a[2]**2 + a[3]**2;
	msvk[a[5]] += a[2]**2 + a[3]**2;
    }
    mav /= atoms.length; msv /= atoms.length;
    cvNkT.push(msv);
    for (let i = 0; i < settings.numColors; i++) {
	    msvk[i] /= settings.atoms.count;
            cvNkTk[i].push(msvk[i]); 
    }
    if (Date.now() - starttime > 5000) {
	ssuts[0].push(supc()); ssuts[1].push(supa()); ssuts[2].push(subpa());
	ssuts[3].push(lifelikeClus()[1][0][2]);
    }

    // update positions 
    for (const a of atoms) {
	// dr/dt = v 
	a[0] += a[2] * dt; a[1] += a[3] * dt;

	// upon reaching the canvas fringes
	if (!settings.wrapAround) { // hard wall		
	    if (a[0] < 0)            {a[0] = -a[0] % canv.width;                     a[2] *= -1;} // x wraps around if ricochet exceeds width
	    if (a[0] >= canv.width)  {a[0] = (2 * canv.width - a[0]) % canv.width;   a[2] *= -1;} // x<0 and idem if ricochet exceeds width
	    if (a[1] < 0)            {a[1] = -a[1] % canv.height;                    a[3] *= -1;} // idem
	    if (a[1] >= canv.height) {a[1] = (2 * canv.height - a[1]) % canv.height; a[3] *= -1;} // idem
	} else {                            // wrap around with toroidal topology
	    settings.wallThickness = 0;
	    if (a[0] > canv.width)  a[0] %= canv.width;
	    else if (a[0] < 0)      a[0] = canv.width + a[0] % canv.width; //a[0] += canv.width;
	    if (a[1] > canv.height) a[1] %= canv.height;
	    else if (a[1] < 0)      a[1] = canv.height + a[1] % canv.height;
	}
    }
};



/*** LET THERE BE LIGHT ***/

let starttime = Date.now();

// Initialize PRNG seed 
var mb32closure = mulberry32prng(settings.seed);  // closure PRNG initialized with seed
getSeedFromUrlFragment();

// Draw canvas
const canv = document.getElementById("mycanvas");
const crc = canv.getContext("2d");
updateCanvas();      // stretch canvas to cover window and paint it

// Set interaction forces
setColors();
randomInteractions();

// Create atoms, initialize clusters and entities
const atoms = new Array();
const clusters = [], entities = [];
let nsplits, nmerges;
restartAtoms(settings.atoms.count, true);

// Set up sundry functionalities  
var prod_st = 0, prod_x = 0, prod_y = 0; // click-induced pulse-shaped in time and strength prod 
var exploration_timer = 0;
var mav, msv;  // mean absolute velocity as an estimate of on-screen activity, mean sq velocity
const cvNkT = []; // specific internal energy: U/N = v^2/N
//Array(settings.numColors).fill([]); // initializes with multiple copies of one instance: dmitripavlutin.com/javascript-fill-array/ 
const cvNkTk = [...Array(maxNumCol)].map(() => {return []}); // [...Array(settings.numColors)].map(() => {return []}); 
const ssuts = [[], [], [], []]; // mean ssd, or specific free energy time series
setupGui();
setupHotkeys();
setupProd();
// Plotting
const plt = document.getElementById("fig01");
plt.style.height = canv.height * 0.9;
let layout = {grid: {rows:7, columns:1, roworder: "top to bottom"}, barmode: "overlay", 
	      title: "plotly", showlegend: true, margin: {l: 30, r: 10, b: 20, t: 20, pad: 5},
	      xaxis1: {anchor: "y3"}, xaxis3: {anchor: "y4"}, xaxis4: {anchor: "y6"}, 
	      xaxis7: {anchor: "y7", type: "linear", autorange: true}, yaxis7: {type: "log"}};


/*** MOVE ONWARD: REFRESH AND READJUST ***/

let oldnow = performance.now(); //Date.now();
repaint();

function repaint(timeStamp) {
    updateCanvas();
		
    stepForward();

    // draw atoms
    for (const a of atoms) {
	if (settings.drawings.round) drawEllipse(a[0], a[1], settings.atoms.radius, hsl2str(...a[4]));
	else                         drawSquare(a[0], a[1], settings.atoms.radius, hsl2str(...a[4]));                
    }
    if (settings.drawings.clusters) {
	// recompute clusters
	// scan from lesl level upward, lesl is the lowest level with cluster changes 
	let [doEntscan, lesl] = trackClusters();

	// udpate entities object		
	if (doEntscan) scanUpdateEnts(lesl);

	// draw clusters
	for (let l = 1; l <= topLiveClusLev(); l++) drawClusters(l);

	// mark lifelike clusters
	const [,su,] = lifelikeClus();
	const e = entities[su[0][0]][su[0][1]];
	if (e[3].includes(0)) {
	    const lci = e[1][e[3].indexOf(0)];
	    const c = clusters[su[0][0]][lci];
	    drawEllipse(x = c[0], y = c[1], r = 40, color = "hsl(0,0%,100%,0.3)", fill = false, lw = 12, dash = [false, 1, 0]);
	}

    }

    readjust(timeStamp);

    if (settings.showplots) plots();

    // Tally atoms within canvas
    const fas = atoms.filter(inSight).length/atoms.length;  
    if (fas < 1) console.log("Fraction of atoms in sight: ", fas);

    window.requestAnimationFrame(repaint);
};

// post-frame stats and readjustments
function readjust(timeStamp) {
    // record fps
    if (timeStamp > oldnow) {
	const new_fps = 1000. / (timeStamp - oldnow);
	settings.fps = Math.round(settings.fps * 0.8 + new_fps * 0.2)
	oldnow = timeStamp;
    }

    // adapt logTimeStep based on activity
    let dt = 10 ** settings.logTimeStep;
    if (mav > 30. && dt > 5.) dt /= 1.1;
    if (dt < 0.9) dt *= 1.01; else if (dt > 1.1) dt /= 1.01;
    settings.logTimeStep = Math.log10(dt);

    // decrease prod duration if positive 
    if (prod_st != 0) prod_st -= (prod_st > 0) ? 1 : -1;

    if (settings.explore) roamParamspace();
}


/*** PRINT STATS ***/ 

function numAtomsNow() {return settings.atoms.count * settings.colors.length;}    
function numClus() {
    let nl = [], nd = [], sl = 0, sd = 0;
    if (clusters.length <= 1) return undefined; 
    for (l = 1; l < clusters.length; l++) {
	nl[l] = 0; nd[l] = 0;
	for (c of clusters[l]) (c.length > 1) ? nl[l]++ : nd[l]++;
	sl += nl[l]; sd += nd[l];
    }
    return [nl, nd, sl, sd];
}
function topLiveClusLev() {
    //for (let l = 1; l < numClus()[0].length; l++)
    //    if (numClus()[0][l] == 0) return l - 1;
    //return l - 1;
    for (let l = numClus()[0].length - 1; l >= 1; l--)
	if (numClus()[0][l] > 0) return l;
    return l;
}
function liveClus() {
    let lc = [], ilc = [];
    lc.push(clusters[0]);
    for (let l = 1; l < clusters.length; l++) {
	lc[l] = []; ilc[l] = [];
	for (let ci = 0; ci < clusters[l].length; ci++)
	    if (isClusLive(l, ci)) {
		lc[l].push(clusters[l][ci]);
		ilc[l].push(ci);
	    }
    }
    return [lc, ilc];
}

function sul() { 
    let sul = new Array(clusters.length).fill(0); 
    let sulp = new Array(clusters.length).fill(0); 
    for (let l=1; l <= topLiveClusLev(); l++) {
	for (const c of clusters[l]) 
	    if (c.length > 1 && c[6].length > 0)
		for (let su of c[6]) sul[l] += su;
	sulp[l] = (l==1) ? sul[l] / numAtoms : sul[l] / numClus()[0][l-1]; 
    }
    return [sul, sulp]; 
}
function supc() {return sumArray(sul()[0])/numClus()[2];} // per live cluster
function supa() {return sumArray(sul()[0])/ numAtomsNow();} // per atom
function omniclus() {
    M = Array(clusters[0].length).fill().map((el, ind) => ind);
    const [X, bc] = getMemberCoordinates(1, M); 
    const [sv1, sv2, tanphi, D, ind] = svd(X, bc);
    const V = math.multiply(D.v, math.diag([sv1**2, sv2**2]), math.transpose(D.v)); // var-cov matrices hold squared distances
    return [bc, V, M];
}
function subpa() {
    const oc = omniclus();
    const bsu = computeSumsrp(1, oc[2], oc[1], oc[0])[0]; 
    return bsu / numAtomsNow();		    
}

function topbotSqdistsNow() { 
    let sumsqdis = 0;
    if (clusters.length == 0) return sumsqdis;
    topclus = clusters.slice(-1)[0][0];
    if (clusters.slice(-1)[0].length==1 && topclus != undefined) {
	for (let a of atoms){
	    let d2 = (a[0] - topclus[0])**2 + (a[1] - topclus[1])**2;
	    sumsqdis += d2;
	}
    }
    return sumsqdis;			    
}

function biggestClus() {
    let c = [], numemb = [];  	    
    for (let l = 1; l <= topLiveClusLev(); l++) {
	c[l] = numemb[l] = 0;
	for (let ci = 0; ci < clusters[l].length; ci++) 
	    if (isClusLive(l, ci) && clusters[l][ci][5].length > numemb[l]) 
		{c[l] = ci; numemb[l] = clusters[l][ci][5].length;}
    }
    return numemb // [...c, ...numemb]
}

function clusSizes() {
    let cs = [];
    cs[0] = new Array(math.max(biggestClus())).fill(0);
    for (let l = 1; l <= topLiveClusLev(); l++) {
	cs[l] = new Array(biggestClus()[l]).fill(0);
	for (let ci = 0; ci < clusters[l].length; ci++) 
	    if (isClusLive(l, ci))
		//cs[l].push(clusters[l][ci][5].length); 
		{cs[l][clusters[l][ci][5].length-1] += 1; 
		 cs[0][clusters[l][ci][5].length-1] += 1;} 
    }
    return cs;
}
function findDegenClus() {
    let dc = [];
    for (let l = 1; l <= topLiveClusLev(); l++) {
	dc[l] = [];
	for (let ci = 0; ci < clusters[l].length; ci++)
	    if (isClusLive(l, ci) && clusters[l][ci][5].length == 1) 
		dc[l].push(clusters[l][ci]);
    }
    return dc;
}

function inSight(a) {return 0 <= a[0] && a[0] < canv.width && 0 <= a[1] && a[1] < canv.height;}

function lifespans() {
    let s = [];
    for (let l = 1; l < entities.length; l++) {
	s[l] = [];
	for (const e of entities[l]) 
	    for (let i=0; i< e[1].length; i++) 
		if (e[3][i] > 0) s[l].push(e[3][i]/10**3); 
		else             s[l].push((Date.now() - e[2][i])/10**3);
    }
    return s; 
}
function entityComplexity(l, i) {
    // enough with only entity information
    const I1 = 32 * math.log(2); // set the max val of vars to 2^32, like pixel number, so complexity is 9.63
	
    if (l == 0) 
	return nd * I1; // +math.log(settings.numColors)/math.log(2**64);  // atom information is just color and location
    else {
	const e = entities[l][i];
	let C = (3*nd - 1) * I1; // this cluster's location (d), axes (d), orientation (d-1) 
	for (const ei of e[0]) {
	    C += entityComplexity(l - 1, ei);
	}
	return C;
    }
}
function addGaussDiffentropyRecursively(l, i) {
    if (l == 0) 
	return nd + math.log(settings.numColors)/math.log(2**64);  // log(3)/log(2)/64 
    else {
	const c = clusters[l][i];
	const Z = rebuildCovmat(c); 
	let h = nd/2 + 1/2 * math.log(math.det(math.multiply(2, math.pi, Z))); // this cluster's diffentropy
	for (const ci of c[5]) {
	    h += addGaussDiffentropyRecursively(l - 1, ci);
	}
		    if (isNaN(h)) debugger
	return h;
    }
}
function DlkOfAtomDistribFromClusToSingle() {
    function computeLogGaussClusRecursively(l, i, logq0) {
	const c = clusters[l][i]; 
	const Z = rebuildCovmat(c);
	for (const mi of c[5]) { 
	    const m = clusters[l-1][mi];
	    const logqi = logq0 - mahalanobisInnerProd([m[0] - c[0], m[1] - c[1]], Z) - nlgc(Z);
			    console.log(l,i,mi,logqi-logq0,-nlgc(Z))
	    if (l == 1) { 
		logaq[mi] = logqi;
		logap[mi] = - mahalanobisInnerProd([m[0] - oc[0], m[1] - oc[1]], oV) - nlgc(oV);
	    } else
		computeLogGaussClusRecursively(l-1, mi, logqi);
	}
    }

    // this is probably not useful for anything

    // compute only at atoms
    // P distribution: either single cluster or uniform distribution
    let kld = 0, logaq = [], logap = [];
    const [oc, oV, A] = omniclus();
    const [lc, ilc]  = liveClus();
    const tl = topLiveClusLev();
    computeLogGaussClusRecursively(tl, ilc[tl][0], 0);
    for (let i = 0; i < A.length; i++) 	
	kld += math.exp(logaq[i]) * (logaq[i] - logap[i]);

    kld /= sumArray(logaq.map(el => math.exp(el)));		    
    return kld;
} 
function clusComplexity(l, i) {
    const e = entities[l][i]; 
    // only for live entities 
    if (!e[3].includes(0))  return NaN;
    // requires cluster information
    const ci = e[1][e[3].lastIndexOf(0)];

    const h = addGaussDiffentropyRecursively(l, ci);
    return h;
}
function entComplexity(l, i) {
    const h = entityComplexity(l, i);
    return h;
}
function lifelikeClus() {
    let u = [], s = []; // liveness per level and flattened stats
    for (let l = 0; l < entities.length; l++) {
	u[l] = [];
	for (let i = 0; i < entities[l].length; i++) {
	    const e = entities[l][i];
	    //  longest-living span or accumulated span ? accumulated makes more sense
	    let cls = lls = 0; // current and longest lifespan 
	    let als; // accumulated lifespan 
	    if (e[3].includes(0)) 
		cls = (Date.now() - e[2][e[3].indexOf(0)]) / 1000;
	    lls = Math.max(cls, Math.max(...e[3]) / 1000);
	    als = cls + sumArray(e[3]) / 1000;
	    u[l].push(als * entComplexity(l, i)); //s[l].push({[[l,i]] : ls * entComplexity(l, i)});
	    s.push([l, i, Number((als * entComplexity(l, i)).toFixed(3)), 
		    cls, lls, als, Number(entComplexity(l, i).toFixed(3)), Number(clusComplexity(l,i).toFixed(3))]);
	}
    }
    // sort by liveness
    const su = s.toSorted(([,,a,,,,],[,,b,,,,]) => {if (isFinite(b-a)) return b - a; else return NaN});
    // sort by complexity
    const ss = s.toSorted(([,,,,,,a],[,,,,,,b]) => {if (isFinite(b-a)) return b - a; else return NaN});

    return [u, su, ss]; // lifelikeClus()[1] to see ranked by ent liveness 
}

console.log("settings", settings)

let numclus = 0; 
window.setInterval(() => {
    if (numClus()[2] != numclus) {
	console.log(clusters);
	console.log('Number of atoms, maxClus, clusters:', numAtomsNow(), settings.maxNumLiveClusters, numClus())
	let ssd = sul()[0].map((x) => Math.round(x));
	let totdis = Math.round(ssd.reduce((a,b)=>a+b,0));
	console.log("SSDs: ", ssd, totdis, totdis/numAtomsNow(), Math.round(100*totdis/topbotSqdistsNow()))
	console.log("Biggest clusters: ",biggestClus())
	numclus = numClus()[2];
    }
    //if (numDeadClusNow()>0) alert(`${numDeadClusNow()} cluster(s) died`);
}, 1000);


/*** PLOTTING ***/

function vsqrt(x) {return x.map(el => Math.sqrt(el))};
function vlog10(x) {return x.map(el => Math.log10(el))};
function vllog10(x) {return x.map(el => Math.log10(el.length))};
function plots() {
    let cl = Array(clusters.length).fill().map((elm, ind) => ind);
    let ts = Array(cvNkT.length).fill().map((elm, ind) => ind);
    let cs1 = Array(biggestClus()[1]).fill().map((elm, ind) => ind);
    let trace00 = {name: "MSV", x: ts, y: cvNkT, xaxis: "x1", yaxis: "y1"};
    trace0i = [];
    for (let i=1; i <= settings.numColors; i++)	
	trace0i[i-1] = {name: `MSV${i}`, x: ts, y: cvNkTk[i-1], xaxis: "x1", yaxis: "y1"};
    let trace11 = {name: "suplivclu", x: ts, y: ssuts[0], xaxis: "x1", yaxis: "y2"};
    let trace12 = {name: "supat", x: ts, y: ssuts[1], xaxis: "x1", yaxis: "y2"};
    let trace13 = {name: "refsupat", x: ts, y: ssuts[2], xaxis: "x1", yaxis: "y2"};
    let trace21 = {name: "max liveness", x: ts, y: ssuts[3], xaxis: "x1", yaxis: "y3"};
    //let trace2 = {name: "bigclus",x: cl, y: vlog10(biggestClus()), xaxis: "x2", yaxis: "y4", type: "scatter"};
    let trace31 = {name: "clusiz1",x: cs1, y: clusSizes()[1], xaxis: "x3", yaxis: "y4", type: "scatter"};
    let trace32 = {name: "clusiz2",x: cs1, y: clusSizes()[2], xaxis: "x3", yaxis: "y4", type: "scatter"};
    let trace33 = {name: "clusizN",x: cs1, y: clusSizes()[0], xaxis: "x3", yaxis: "y4", type: "scatter"};
    let trace41 = {name: "live ents", x: cl, y: vlog10(numEnts()[0]), xaxis: "x4", yaxis: "y5"};
    let trace42 = {name: "dead ents", x: cl, y: vlog10(numEnts()[1]), xaxis: "x4", yaxis: "y5"};
    let trace43 = {name: "all ents now", x: cl, y: vllog10(entities), xaxis: "x4", yaxis: "y5"};
    let trace51 = {name: "live clus", x: cl, y: vlog10(numClus()[0]), xaxis: "x4", yaxis: "y6"};
    let trace52 = {name: "dead clus", x: cl, y: vlog10(numClus()[1]), xaxis: "x4", yaxis: "y6"};

    let tracehist = [];
    for (let i=1; i < entities.length; i++)
	tracehist[i-1] = {name: `count L${i}`, x: lifespans()[i], type: 'histogram', histfunc: "count", opacity: .4, xaxis: "x7", yaxis: "y7"};

    Plotly.newPlot(plt, [trace00, ...trace0i, trace11, trace12, trace13, trace21, trace31, trace32, trace33, trace41, trace42, trace43, trace51, trace52, ...tracehist], layout); 
}


/*** RECORD VIDEO ***/ 

function dataUrlDownloader(dataURL, name = `Racemi_${settings.seed}`) {
    const hyperlink = document.createElement("a");
    // document.body.appendChild(hyperlink);
    hyperlink.download = name; // the target will be downloaded on clicking on the hyperlink
    //hyperlink.target = '_blank';
    hyperlink.href = dataURL;
    hyperlink.click();  // HTMLElement.click() method simulates a mouse click on an element
    hyperlink.remove();
};

const videoStream = canv.captureStream(); // stream 
const mediaRecorder = new MediaRecorder(videoStream); // video recorder
let chunks = []; // temporal chunks

mediaRecorder.ondataavailable = (e) => chunks.push(e.data); // store chunks
mediaRecorder.onstop = function (e) {
    const blob = new Blob(chunks, { type: 'video/mp4' }); // chunks --> blob
    const videoDataURL = URL.createObjectURL(blob); // blob --> dataURL
    dataUrlDownloader(videoDataURL); // download video
    chunks = []; // reset chunks
};
// mediaRecorder.start(); // start recording
// mediaRecorder.stop(); // stop recording


/*** EXPORT DATA ***/

function dataExporter() {		
    const newnow = new Date(); 
    const fname = 'racdat_'+ newnow.toJSON() + '.json';

    const data = {
	clus: clusters,
	ents: entities, 
	msv: cvNkT,
	ssu: ssuts,
    };

    // create a blob of the data
    const bilarob = new Blob([JSON.stringify(data)], {type: 'application/json'});

    // Save the file
    saveAs(bilarob, fname);
}
