
const WordCloud = require('./wordcloud2.js')
function deepMerge(obj1, obj2) {
    var key;
    for(key in obj2) {
        obj1[key] = obj1[key] && obj1[key].toString() === "[object Object]" ?
        deepMerge(obj1[key], obj2[key]) : obj1[key] = obj2[key];
    }
    return obj1;
}
export class B2wordcloud {
    constructor(element, options) {
        this._wrapper = element
        this._wrapper.style.position = 'relative'
        this._container = null
        this._tooltip = null
        this._options = deepMerge({
            renderer: 'canvas',
            tooltip: {
                show: true,
                formatter: null
            }
        }, options)
        this._wordcloud2 = null
        this._maskCanvas = null
        this._tempCanvas = null
        this._init()
    }
    _init() {
        this._initContainer()
        this._setOptions()
    }
    _initContainer() {
        if (this._options.renderer === 'div') {
            this._container = document.createElement('div')
            this._container.style.width = '100%'
            this._container.style.height = '100%'
            this._createTempCanvas()

        } else if (this._options.renderer === 'canvas') {
            this._container = document.createElement('canvas')
            this._setCanvasSize()
        }
        this._wrapper.appendChild(this._container)
    }
    _createTempCanvas() {
        this._tempCanvas = document.createElement('canvas')
        this._setCanvasSize(this._tempCanvas)
    }
    _initTooltip() {
        if (!this._tooltip) {
            this._tooltip = document.createElement('div')
            this._tooltip.className = this._options.tooltip.className || ''
            this._tooltip.style.backgroundColor = this._options.tooltip.backgroundColor || 'rgba(0,0,0,0.8)'
            this._tooltip.style.color = '#fff'
            this._tooltip.style.padding = '5px'
            this._tooltip.style.borderRadius = '5px'
            this._tooltip.style.fontSize = '13px'
            this._tooltip.style.lineHeight = '1.4'
            this._tooltip.style.webkitTransition = 'left 0.2s, top 0.2s'
            this._tooltip.style.transition = 'left 0.2s, top 0.2s'
            this._tooltip.style.position = 'absolute'
            this._tooltip.style.whiteSpace = 'nowrap'
            this._tooltip.style.zIndex = '999'
            this._tooltip.style.display = 'none'
        }
        document.body.appendChild(this._tooltip)
    }
    _setCanvasSize(target = this._container) {
        const width = this._wrapper.clientWidth
        const height = this._wrapper.clientHeight
        target.width = width
        target.height = height
    }
    _setOptions() {
        this._fixWeightFactor(this._options)
        if (this._options.tooltip.show) {
            this._initTooltip()
            let tooltipWidth, tooltipHeight, offsetY, offsetX
            const tempHover = this._options.hover
            this._options.hover = (item, dimension, event) => {
                if (tempHover) tempHover(item, dimension, event)
                if (item) {
                    let html = item[0] + ': ' + item[1]
                    if (Object.prototype.toString.call(this._options.tooltip.formatter) === '[object Function]') {
                        html = this._options.tooltip.formatter(item)
                    }
                    this._tooltip.style.display = 'block'
                    
                    tooltipWidth = this._tooltip.clientWidth
                    tooltipHeight = this._tooltip.clientHeight

                    offsetY = tooltipHeight + 15
                    offsetX = tooltipWidth/2 + 5
                    this._tooltip.style.position = 'absolute'
                    this._tooltip.style.top = event.pageY - offsetY + 'px'
                    this._tooltip.style.left = event.pageX - offsetX + 'px'
                    this._tooltip.innerHTML = html
                } else {
                    this._tooltip.style.display = 'none'
                }
                
            }
        }
        if (this._options && this._options.maskImage) {
            this._maskImage()
        } else {
            this._render()
        }
        
    }
    _maskImage() {
        var img = window.document.createElement('img')
        img.crossOrigin = "Anonymous"
        img.src = this._options.maskImage
        img.onload = () => {
            this._maskCanvas = document.createElement('canvas');
            this._maskCanvas.width = img.width;
            this._maskCanvas.height = img.height;
            var ctx = this._maskCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);
            var imageData = ctx.getImageData(
            0, 0, this._maskCanvas.width, this._maskCanvas.height);
            var newImageData = ctx.createImageData(imageData);
            for (var i = 0; i < imageData.data.length; i += 4) {
                var tone = imageData.data[i] +
                    imageData.data[i + 1] +
                    imageData.data[i + 2];
                var alpha = imageData.data[i + 3];
        
                if (alpha < 128 || tone > 128 * 3) {
                    // Area not to draw
                    newImageData.data[i] =
                    newImageData.data[i + 1] =
                    newImageData.data[i + 2] = 255;
                    newImageData.data[i + 3] = 0;
                } else {
                    // Area to draw
                    newImageData.data[i] =
                    newImageData.data[i + 1] =
                    newImageData.data[i + 2] = 0;
                    newImageData.data[i + 3] = 255;
                }
            }
            ctx.putImageData(newImageData, 0, 0);
            this._render()
        }
    }
    _render() {
        if (this._maskCanvas) {
            this._options.clearCanvas = false
            /* Determine bgPixel by creating
                another canvas and fill the specified background color. */
            var bctx = document.createElement('canvas').getContext('2d');

            bctx.fillStyle = this._options.backgroundColor || '#fff';
            bctx.fillRect(0, 0, 1, 1);
            var bgPixel = bctx.getImageData(0, 0, 1, 1).data;

            var maskCanvasScaled = document.createElement('canvas');
            maskCanvasScaled.width = this._options.renderer === 'canvas' ? this._container.width : this._container.clientWidth;
            maskCanvasScaled.height = this._options.renderer === 'canvas' ? this._container.height : this._container.clientHeight;
            var ctx = maskCanvasScaled.getContext('2d');

            ctx.drawImage(this._maskCanvas,
                0, 0, this._maskCanvas.width, this._maskCanvas.height,
                0, 0, maskCanvasScaled.width, maskCanvasScaled.height);

            var imageData = ctx.getImageData(0, 0, maskCanvasScaled.width, maskCanvasScaled.height);
            var newImageData = ctx.createImageData(imageData);
            for (var i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i + 3] > 128) {
                    newImageData.data[i] = bgPixel[0];
                    newImageData.data[i + 1] = bgPixel[1];
                    newImageData.data[i + 2] = bgPixel[2];
                    newImageData.data[i + 3] = bgPixel[3];
                } else {
                    // This color must not be the same w/ the bgPixel.
                    newImageData.data[i] = bgPixel[0];
                    newImageData.data[i + 1] = bgPixel[1];
                    newImageData.data[i + 2] = bgPixel[2];
                    newImageData.data[i + 3] = bgPixel[3] ? (bgPixel[3] - 1) : 0;
                }
            }
            ctx.putImageData(newImageData, 0, 0);
            var _ctx = this._tempCanvas ? this._tempCanvas : this._container
            ctx = _ctx.getContext('2d');
            ctx.drawImage(maskCanvasScaled, 0, 0);
        }
        this._wordcloud2 = WordCloud(this._options.renderer === 'canvas' ? this._container : [this._tempCanvas, this._container], this._options)
    }
    _fixWeightFactor(option) {
        option.maxFontSize = typeof option.maxFontSize === 'number' ? option.maxFontSize : 36
        option.minFontSize = typeof option.minFontSize === 'number' ? option.minFontSize : 6
        if(option.list && option.list.length > 0){
            var min = option.list[0][1]
            var max = 0
            for(var i = 0, len = option.list.length; i < len; i++ ) {
                if(min > option.list[i][1]) {
                    min = option.list[i][1]
                }
                if(max < option.list[i][1]) {
                    max = option.list[i][1]
                }
            }
            
            //用y=ax^r+b公式确定字体大小
            if(max > min){
                var r = typeof option.fontSizeFactor === 'number' ? option.fontSizeFactor : 1 / 10
                var a = (option.maxFontSize - option.minFontSize) / (Math.pow(max, r) - Math.pow(min, r))
                var b = option.maxFontSize - a * Math.pow(max, r)
                option.weightFactor = function (size) {
                    return Math.ceil(a * Math.pow(size, r) + b)
                }
            }else{
                option.weightFactor = function (size) {
                    return option.minFontSize
                }
            }
        }
    }
    resize() {
        if (this._options.renderer === 'canvas') {
            this._setCanvasSize()
        } else if (this._options.renderer === 'div') {
            this._container.textContent = ''
        }
        this._render()
    }
}


module.exports = B2wordcloud