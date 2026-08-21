import {expect, test} from 'bun:test';
import {makeHtmlInCanvasPresentation} from '../html-in-canvas-presentation';
import {passThroughCapture, shouldAutoCapture} from '../pass-through-capture';
import {fade} from '../presentations/fade';

test('html-in-canvas presentations declare capture capability', () => {
	expect(passThroughCapture.capturesElementImage).toBe(true);
});

test('DOM presentations do not declare capture capability', () => {
	expect(
		(fade() as {capturesElementImage?: boolean}).capturesElementImage,
	).toBe(undefined);
});

test('auto-capture only when the exiting transition captures and the entering one does not', () => {
	const capturing = {capturesElementImage: true};
	const dom = {};

	expect(shouldAutoCapture(dom, capturing, true)).toBe(true);
	expect(shouldAutoCapture(capturing, capturing, true)).toBe(false);
	expect(shouldAutoCapture(dom, dom, true)).toBe(false);
	expect(shouldAutoCapture(capturing, dom, true)).toBe(false);
	expect(shouldAutoCapture(dom, capturing, false)).toBe(false);
});

test('pass-through capture is built on makeHtmlInCanvasPresentation', () => {
	const shader = () => ({
		clear: () => undefined,
		cleanup: () => undefined,
		draw: () => undefined,
	});
	const factory = makeHtmlInCanvasPresentation(shader);
	expect(typeof factory).toBe('function');
	const presentation = factory({});
	expect(typeof presentation.component).toBe('function');
	expect(presentation.capturesElementImage).toBe(true);
});
