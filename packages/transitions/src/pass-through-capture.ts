import type {HtmlInCanvasShader} from './html-in-canvas-presentation';
import {makeHtmlInCanvasPresentation} from './html-in-canvas-presentation';
import {uploadElementImage} from './presentations/upload-element-image';

const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
	v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;

in vec2 v_uv;
out vec4 outColor;

void main() {
	outColor = mix(texture(u_prev, v_uv), texture(u_next, v_uv), u_time);
}`;

const compileShader = (
	gl: WebGL2RenderingContext,
	source: string,
	type: number,
): WebGLShader => {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to create shader');
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Failed to compile shader: ${log}`);
	}

	return shader;
};

export const passThroughCaptureShader: HtmlInCanvasShader<
	Record<string, unknown>
> = (canvas) => {
	const gl = canvas.getContext('webgl2', {premultipliedAlpha: true});
	if (!gl) {
		throw new Error('Failed to create WebGL2 context');
	}

	const program = gl.createProgram();
	if (!program) {
		throw new Error('Failed to create WebGL program');
	}

	const vs = compileShader(gl, VERTEX_SHADER, gl.VERTEX_SHADER);
	const fs = compileShader(gl, FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program);
		throw new Error(`Failed to link program: ${log}`);
	}

	const prevTex = gl.createTexture();
	const nextTex = gl.createTexture();
	for (const tex of [prevTex, nextTex]) {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([0, 0, 0, 0]),
		);
	}

	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW,
	);
	const aPos = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

	const uTime = gl.getUniformLocation(program, 'u_time');
	const uPrev = gl.getUniformLocation(program, 'u_prev');
	const uNext = gl.getUniformLocation(program, 'u_next');

	return {
		clear: () => {
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		},
		cleanup: () => {
			gl.deleteProgram(program);
			gl.deleteTexture(prevTex);
			gl.deleteTexture(nextTex);
		},
		draw: ({prevImage, nextImage, width, height, time}) => {
			if (!prevImage && !nextImage) {
				return;
			}

			if (prevImage && (prevImage.width === 0 || prevImage.height === 0)) {
				return;
			}

			if (nextImage && (nextImage.width === 0 || nextImage.height === 0)) {
				return;
			}

			const effectiveTime = !prevImage ? 0 : !nextImage ? 1 : time;

			gl.viewport(0, 0, width, height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.useProgram(program);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, prevTex);
			if (prevImage) {
				uploadElementImage(gl, prevImage);
			}

			gl.uniform1i(uPrev, 0);

			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, nextTex);
			if (nextImage) {
				uploadElementImage(gl, nextImage);
			}

			gl.uniform1i(uNext, 1);

			gl.uniform1f(uTime, effectiveTime);

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		},
	};
};

export const passThroughCapture = makeHtmlInCanvasPresentation(
	passThroughCaptureShader,
)({});

/**
 * An html-in-canvas transition needs the pixels of its exiting scene, which
 * in a chain of overlapping transitions are captured by the presentation the
 * scene entered through. If that neighboring presentation does not capture
 * (plain DOM), it must be wrapped in the pass-through capture.
 */
export const shouldAutoCapture = (
	enteringPresentation: {capturesElementImage?: boolean},
	exitingPresentation: {capturesElementImage?: boolean},
	htmlInCanvasSupported: boolean,
): boolean => {
	return (
		exitingPresentation.capturesElementImage === true &&
		enteringPresentation.capturesElementImage !== true &&
		htmlInCanvasSupported
	);
};
