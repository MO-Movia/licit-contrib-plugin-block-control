import { getBaseAttrs, getAttrsSimple, SimpleImageNodeSpec } from './SimpleImageNodeSpec';

describe('getBaseAttrs', () => {
    test('extracts all attributes and styles correctly', () => {
        const dom = document.createElement('img');
        dom.setAttribute('alt', 'example');
        dom.setAttribute('src', 'image.png');
        dom.setAttribute('title', 'An image');
        dom.setAttribute('width', '200');
        dom.setAttribute('height', '100');
        dom.setAttribute('fitToParent', '1');
        dom.setAttribute('simpleImg', 'true');

        const attrs = getBaseAttrs(dom);
        expect(attrs).toEqual({
            alt: 'example',
            src: 'image.png',
            title: 'An image',
            width: 200,
            height: 100,
            fitToParent: 1,
            simpleImg: 'true',
        });
    });

    test('uses style values if attributes not set', () => {
        const dom = document.createElement('img');
        dom.style.width = '150px';
        dom.style.height = '75px';
        dom.setAttribute('simpleImg', 'false');

        const attrs = getBaseAttrs(dom);
        expect(attrs.width).toBe(150);
        expect(attrs.height).toBe(75);
    });

    test('defaults to null and 0 for missing values', () => {
        const dom = document.createElement('img');
        const attrs = getBaseAttrs(dom);
        expect(attrs.width).toBe(null);
        expect(attrs.height).toBe(null);
        expect(attrs.fitToParent).toBe(0);
        expect(attrs.simpleImg).toBe('false');
    });
});

describe('getAttrsSimple', () => {
    test('returns false for string input', () => {
        expect(getAttrsSimple('<img />')).toBe(false);
    });

    test('returns false when no simple attribute is set', () => {
        const dom = document.createElement('img');
        expect(getAttrsSimple(dom)).toBe(false);
    });

    test('returns attributes if simple-img is present', () => {
        const dom = document.createElement('img');
        dom.setAttribute('simple-img', 'true');
        dom.setAttribute('simpleImg', 'true'); // override to make it visible in getBaseAttrs
        const result = getAttrsSimple(dom);
        expect(result).toBeTruthy();
        expect(result.simpleImg).toBe('true');
    });

    test('returns attributes if simpleImg is present', () => {
        const dom = document.createElement('img');
        dom.setAttribute('simpleImg', 'true');
        const result = getAttrsSimple(dom);
        expect(result).toBeTruthy();
        expect(result.simpleImg).toBe('true');
    });
});

describe('SimpleImageNodeSpec', () => {
    test('has expected structure and default attrs', () => {
        expect(SimpleImageNodeSpec.inline).toBe(true);
        expect(SimpleImageNodeSpec.draggable).toBe(true);
        expect(SimpleImageNodeSpec.attrs.alt.default).toBe('');
        expect(SimpleImageNodeSpec.attrs.smpleImg.default).toBe('true');
        expect(SimpleImageNodeSpec.parseDOM.length).toBe(1);
        expect(SimpleImageNodeSpec.parseDOM[0].tag).toBe('img[src]');
        expect(typeof SimpleImageNodeSpec.parseDOM[0].getAttrs).toBe('function');
    });

    test('toDOM outputs correct tag and attributes', () => {
        const attrs = {
            src: 'test.jpg',
            alt: 'test',
            title: 'title',
            width: 100,
            height: 50,
            fitToParent: 0,
            simpleImg: 'true',
        };
        const node = { attrs };
        const result = SimpleImageNodeSpec.toDOM(node as any);
        expect(result).toEqual(['img', attrs]);
    });
});
