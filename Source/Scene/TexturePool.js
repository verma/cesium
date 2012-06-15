/*global define*/
define([
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Renderer/PixelDatatype',
        '../Renderer/PixelFormat',
        '../Renderer/Texture'
    ], function(
        destroyObject,
        DeveloperError,
        PixelDatatype,
        PixelFormat,
        Texture) {
    "use strict";

    function PooledTexture(texture, textureTypeKey, pool) {
        this._texture = texture;
        this._textureTypeKey = textureTypeKey;
        this._pool = pool;
    }

    //pass through all methods to the underlying texture
    Object.keys(Texture.prototype).forEach(function(methodName) {
        PooledTexture.prototype[methodName] = function() {
            var texture = this._texture;
            return texture[methodName].apply(texture, arguments);
        };
    });

    //except for destroy, which releases back into the pool
    PooledTexture.prototype.destroy = function() {
        var freeList = this._pool._free[this._textureTypeKey];
        if (typeof freeList === 'undefined') {
            freeList = this._pool._free[this._textureTypeKey] = [];
        }
        freeList.push(this);
    };

    /**
     * A pool of textures.  Textures created from the pool will be released back into the pool
     * when destroy() is called, so future calls to create may re-use a released texture.
     * <br/><br/>
     * Texture pools are useful when textures are being created and destroyed repeatedly.
     *
     * @name TexturePool
     * @constructor
     *
     * @see Texture
     */
    function TexturePool(context) {
        this._free = {};
    }

    /**
     * Create a texture.  This function takes the same arguments as {@link Context#createTexture2D},
     * but may return a pooled texture if there are any available.  If a pooled texture is re-used,
     * and no source is provided, the new texture will still retain its old contents.
     *
     * @memberof TexturePool
     *
     * @param {Context} context The context to use to create textures when needed.
     *
     * @exception {DeveloperError} description is required.
     *
     * @see Context#createTexture2D
     */
    TexturePool.prototype.createTexture2D = function(context, description) {
        if (!description) {
            throw new DeveloperError('description is required.');
        }

        var source = description.source;
        var width = typeof source !== 'undefined' ? source.width : description.width;
        var height = typeof source !== 'undefined' ? source.height : description.height;
        //coerce values to primitive numbers to make textureTypeKey smaller.
        var pixelFormat = +(description.pixelFormat || PixelFormat.RGBA);
        var pixelDatatype = +(description.pixelDatatype || PixelDatatype.UNSIGNED_BYTE);
        var preMultiplyAlpha = +(description.preMultiplyAlpha || pixelFormat === PixelFormat.RGB || pixelFormat === PixelFormat.LUMINANCE);

        var textureTypeKey = JSON.stringify([width, height, pixelFormat, pixelDatatype, preMultiplyAlpha]);

        var freeList = this._free[textureTypeKey];
        if (typeof freeList !== 'undefined' && freeList.length > 0) {
            var texture = freeList.pop();
            if (typeof source !== 'undefined') {
                texture.copyFrom(source);
            }
            return texture;
        }

        return new PooledTexture(context.createTexture2D(description), textureTypeKey, this);
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof TexturePool
     *
     * @return {Boolean} True if this object was destroyed; otherwise, false.
     *
     * @see TexturePool#destroy
     */
    TexturePool.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @memberof TexturePool
     *
     * @return {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see TexturePool#isDestroyed
     *
     * @example
     * pool = pool && pool.destroy();
     */
    TexturePool.prototype.destroy = function() {
        var free = this._free;
        Object.keys(free).forEach(function(textureTypeKey) {
            free[textureTypeKey].forEach(function(texture) {
                texture._texture.destroy();
            });
        });
        return destroyObject(this);
    };

    return TexturePool;
});