
const WordCloud = require('./wordcloud2.js')
function deepMerge(obj1, obj2) {
    var key;
    for(key in obj2) {
        obj1[key] = obj1[key] && obj1[key].toString() === "[object Object]" ?
        deepMerge(obj1[key], obj2[key]) : obj1[key] = obj2[key];
    }
    return obj1;
}

// https://github.com/timdream/wordcloud2.js/blob/c236bee60436e048949f9becc4f0f67bd832dc5c/index.js#L233
function updateCanvasMask(shapeCanvas, maskCanvas) {
    /* Determine bgPixel by creating
    another canvas and fill the specified background color. */
    var bctx = document.createElement('canvas').getContext('2d');

    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, 1, 1);
    var bgPixel = bctx.getImageData(0, 0, 1, 1).data;

    var maskCanvasScaled = document.createElement('canvas');
    maskCanvasScaled.width = maskCanvas.width;
    maskCanvasScaled.height = maskCanvas.height;
    var ctx = maskCanvasScaled.getContext('2d');

    ctx.drawImage(shapeCanvas,
    0, 0, shapeCanvas.width, shapeCanvas.height,
    0, 0, maskCanvasScaled.width, maskCanvasScaled.height);

    var imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
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
    ctx = maskCanvas.getContext('2d');
    ctx.drawImage(maskCanvasScaled, 0, 0);
    maskCanvasScaled = ctx = imageData = newImageData = bctx = bgPixel = undefined;

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
            },
            clearCanvas: !options.maskImage
        }, options)
        this._wordcloud2 = null
        this._maskCanvas = null
        this._shapeCanvas = null
        this._tempCanvas = null
        this._maskImg = null
        this._init()
        // 缓存item hover回调参数（主要用于mouseout时判断是否还在item上避免错误隐藏tooltip）
        this._cacheHoverParams = {
            item: null,
            dimension: null,
            event: null
        }
    }
    _init() {
        this._sortList(this._options)
        this._initContainer()
        this._setOptions()
    }
    _sortList(options) {
        options.list = options.list.sort((a, b) => {
            return b[1] - a[1]
        })
    }
    _setDefaultFontSize(options) {
        // 根据最大词频来自动计算最大的词大小
        var maxFontLength = options.list[0][0].length
        var minFontLength = 4
        // 如果最大词频的词太短，可能导致过大，因此以最少5个字来做计算
        if ( maxFontLength < minFontLength ) {
            maxFontLength = minFontLength
        }
        if (options.autoFontSize) {
            options.maxFontSize = this._wrapper.clientWidth / maxFontLength
            options.minFontSize = typeof options.minFontSize === 'number' ? options.minFontSize : 10
        } else {
            options.maxFontSize = typeof options.maxFontSize === 'number' ? options.maxFontSize : 36
        
            options.minFontSize = typeof options.minFontSize === 'number' ? options.minFontSize : 10
        }
        
    }
    _initContainer() {
        this._maskCanvas = document.createElement('canvas')
        this._setCanvasSize(this._maskCanvas)
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
        target.style.width = width + 'px'
        target.style.height = height + 'px'
    }
    _setOptions() {
        this._setDefaultFontSize(this._options)
        !this._options.weightFactor && this._fixWeightFactor(this._options)
        if (this._options.tooltip.show) {
            this._initTooltip()
            let tooltipWidth, tooltipHeight, offsetY, offsetX
            const tempHover = this._options.hover
            const tempOut = this._options.mouseout
            this._options.mouseout = (...args) => {
                if (tempOut) tempOut()
                // hover item为空时才隐藏tooltip
                if (!this._cacheHoverParams.item) {
                  this._tooltip.style.display = 'none'
                }
            }
            
            this._options.hover = (item, dimension, event) => {
                this._cacheHoverParams.item = item
                this._cacheHoverParams.dimension = dimension
                this._cacheHoverParams.event = event
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
                    let top = event.pageY - offsetY
                    let left = event.pageX - offsetX
                    if (typeof this._options.tooltip.position === 'function') {
                        const newPosition = this._options.tooltip.position(item, dimension, event)
                        if (newPosition) {
                            top = newPosition.top
                            left = newPosition.left
                        }
                    }
                    this._tooltip.style.position = 'absolute'
                    this._tooltip.style.top = top + 'px'
                    this._tooltip.style.left = left + 'px'
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
            this._maskImg = img
            this._shapeCanvas = document.createElement('canvas');
            this._shapeCanvas.width = img.width;
            this._shapeCanvas.height = img.height;
            var ctx = this._shapeCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);
            var imageData = ctx.getImageData(
                0, 0, this._shapeCanvas.width, this._shapeCanvas.height);
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
    _render(isResize = false) {
        if (this._maskImg) {
            updateCanvasMask(this._shapeCanvas, this._maskCanvas)
        }
        this._wordcloud2 = new WordCloud(this._options.renderer === 'canvas' ? this._container : [this._tempCanvas, this._container], this._options, this._maskCanvas, isResize)
    }
    _fixWeightFactor(option) {
        if(option.list && option.list.length > 0){
            var min = option.list[option.list.length - 1 ][1]
            var max = option.list[0][1]
            //用y=ax^r+b公式确定字体大小
            // if(max > min) {
            //     option.weightFactor = function (size) {
            //         var r = typeof option.fontSizeFactor === 'number' ? option.fontSizeFactor : 1 / 10
            //         var a = (option.maxFontSize - option.minFontSize) / (Math.pow(max, r) - Math.pow(min, r))
            //         var b = option.maxFontSize - a * Math.pow(max, r)
            //         return Math.ceil(a * Math.pow(size, r) + b)
            //     }
            // }else{
            //     option.weightFactor = function (size) {
            //         return option.maxFontSize
            //     }
            // }

            //使用linerMap计算词云大小
            if (max > min) {
                option.weightFactor = function(val) {
                    var subDomain = max - min
                    var subRange = option.maxFontSize - option.minFontSize
                    if (subDomain === 0) {
                        return subRange === 0 ? option.minFontSize : (option.minFontSize + option.maxFontSize) / 2;
                    }
                    if (val === min) {
                        return option.minFontSize;
                    }
                
                    if (val === max) {
                        return option.maxFontSize;
                    }
                    return (val - min) / subDomain * subRange + option.minFontSize;
                }
            } else {
                option.weightFactor = function(size) {
                    return option.maxFontSize
                }
            }
        }
    }
    // resize() {
    //     if (this._options.renderer === 'canvas') {
    //         this._setCanvasSize()
    //     } else if (this._options.renderer === 'div') {
    //         this._container.textContent = ''
    //     }
    //     if (this._maskCanvas) {
    //         this._setCanvasSize(this._maskCanvas)
    //     }
    //     this._render()
    // }
    /**
     * 
     * @param {object} params 事件参数
     *  
     */
    dispatchAction(params) {
        switch (params.type) {
            case 'highlight':
                this._wordcloud2.highlight(params.dataIndex, params.keepAlive)
                break;
            case 'downplay':
                this._wordcloud2.downplay(params.dataIndex, params.keepAlive)
                break;
        }
        
    }
}


module.exports = B2wordcloud