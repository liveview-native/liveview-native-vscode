import * as vscode from 'vscode';

const hsbToRGB = (h: number, s: number, b: number): [number, number, number] => {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return b - (b * s * Math.max(0, Math.min(k, 4 - k, 1)));
    };
    return [f(5), f(3), f(1)];
};

const systemColors: { [key: string]: [number, number, number] } = {
    "red": [255, 59, 48],
    "orange": [255, 149, 0],
    "yellow": [255, 204, 0],
    "green": [52, 199, 89],
    "mint": [0, 199, 190],
    "teal": [48, 176, 199],
    "cyan": [50, 173, 230],
    "blue": [0, 122, 255],
    "indigo": [88, 86, 214],
    "purple": [175, 82, 222],
    "pink": [255, 45, 85],
    "brown": [165, 132, 94]
};

export const stylesheetColorProvider: vscode.DocumentColorProvider = {
    provideColorPresentations(color, context, token) {
        const opacity = color.alpha !== 1 ? `, opacity: ${color.alpha}` : "";
        if (color.red === color.green && color.red === color.blue) { // if all components are the same, use the `white` initializer.
            return [
                new vscode.ColorPresentation(
                    `Color(.sRGB, white: ${color.red}${opacity})`
                )
            ];
        } else {
            return [
                new vscode.ColorPresentation(
                    `Color(.sRGB, red: ${color.red}, green: ${color.green}, blue: ${color.blue}${opacity})`
                )
            ];
        }
    },
    provideDocumentColors(document, token) {
        const text = document.getText();
        
        const rgbExpr = /Color\(\s*(\.(?<colorSpace>\w+)\,)?\s*red:\s*(?<red>\d+(\.\d*)?)\,\s*green:\s*(?<green>\d+(\.\d*)?)\,\s*blue:\s*(?<blue>\d+(\.\d*)?)(\,\s*opacity:\s*(?<opacity>\d+(\.\d*)?))?\s*\)/g;
        const rgbColors = [...text.matchAll(rgbExpr)].map((color) => new vscode.ColorInformation(
            new vscode.Range(document.positionAt(color.index!), document.positionAt(color.index! + color[0].length)),
            new vscode.Color(+color.groups!.red, +color.groups!.green, +color.groups!.blue, +(color.groups!.opacity ?? 1))
        ));

        const whiteExpr = /Color\(\s*(\.(?<colorSpace>\w+)\,)?\s*white:\s*(?<white>\d+(\.\d*)?)(\,\s*opacity:\s*(?<opacity>\d+(\.\d*)?))?\s*\)/g;
        const whiteColors = [...text.matchAll(whiteExpr)].map((color) => new vscode.ColorInformation(
            new vscode.Range(document.positionAt(color.index!), document.positionAt(color.index! + color[0].length)),
            new vscode.Color(+color.groups!.white, +color.groups!.white, +color.groups!.white, +(color.groups!.opacity ?? 1))
        ));

        const hsbExpr = /Color\(\s*hue:\s*(?<hue>\d+(\.\d*)?)\,\s*saturation:\s*(?<saturation>\d+(\.\d*)?)\,\s*brightness:\s*(?<brightness>\d+(\.\d*)?)(\,\s*opacity:\s*(?<opacity>\d+(\.\d*)?))?\s*\)/g;
        const hsbColors = [...text.matchAll(hsbExpr)].map((color) => new vscode.ColorInformation(
            new vscode.Range(document.positionAt(color.index!), document.positionAt(color.index! + color[0].length)),
            new vscode.Color(...hsbToRGB(+color.groups!.hue, +color.groups!.saturation, +color.groups!.brightness), +(color.groups!.opacity ?? 1))
        ));

        const namedExpr = /Color\.(?<name>\w+)/g;
        const namedColors = [...text.matchAll(namedExpr)].map((color) => {
            const [red, green, blue] = systemColors[color.groups!.name] ?? [255, 255, 255];
            return new vscode.ColorInformation(
                new vscode.Range(document.positionAt(color.index!), document.positionAt(color.index! + color[0].length)),
                new vscode.Color(red / 255, green / 255, blue / 255, 1)
            );
        });

        return [...rgbColors, ...whiteColors, ...hsbColors, ...namedColors];
    },
}