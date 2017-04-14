/*global define*/
define([
        '../Core/AssociativeArray',
        '../Core/BoundingSphere',
        '../Core/Cartesian3',
        '../Core/Color',
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Matrix4',
        '../Scene/CircleEmitter',
        '../Scene/ParticleSystem',
        './BoundingSphereState',
        './Property'
    ], function(
        AssociativeArray,
        BoundingSphere,
        Cartesian3,
        Color,
        defined,
        destroyObject,
        DeveloperError,
        Matrix4,
        CircleEmitter,
        ParticleSystem,
        BoundingSphereState,
        Property) {
    'use strict';

    var defaultStartScale = 1.0;
    var defaultEndScale = 1.0;
    var defaultStartColor = Color.WHITE;
    var defaultEndColor = Color.WHITE;
    var defaultRate = 5.0;
    var defaultMinWidth = 16.0;
    var defaultMinHeight = 16.0;
    var defaultMaxWidth = 16.0;
    var defaultMaxHeight = 16.0;
    var defaultLifeTime = Number.MAX_VALUE;
    var defaultLoop = true;
    var defaultEmitterModelMatrix = Matrix4.IDENTITY;
    var defaultEmitter = new CircleEmitter({radius: 0.5})
    var defaultMinSpeed = 5.0;
    var defaultMaxSpeed = 5.0;
    var defaultMinLife = 5.0;
    var defaultMaxLife = 5.0;

    var modelMatrixScratch = new Matrix4();

    /**
     * A {@link Visualizer} which maps {@link Entity#model} to a {@link Model}.
     * @alias ModelVisualizer
     * @constructor
     *
     * @param {Scene} scene The scene the primitives will be rendered in.
     * @param {EntityCollection} entityCollection The entityCollection to visualize.
     */
    function ParticleSystemVisualizer(scene, entityCollection) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(scene)) {
            throw new DeveloperError('scene is required.');
        }
        if (!defined(entityCollection)) {
            throw new DeveloperError('entityCollection is required.');
        }
        //>>includeEnd('debug');

        entityCollection.collectionChanged.addEventListener(ParticleSystemVisualizer.prototype._onCollectionChanged, this);

        this._scene = scene;
        this._primitives = scene.primitives;
        this._entityCollection = entityCollection;
        this._particleHash = {};
        this._entitiesToVisualize = new AssociativeArray();
        this._onCollectionChanged(entityCollection, entityCollection.values, [], []);
    }

    /**
     * Updates models created this visualizer to match their
     * Entity counterpart at the given time.
     *
     * @param {JulianDate} time The time to update to.
     * @returns {Boolean} This function always returns true.
     */
    ParticleSystemVisualizer.prototype.update = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }
        //>>includeEnd('debug');

        var entities = this._entitiesToVisualize.values;
        var particleHash = this._particleHash;
        var primitives = this._primitives;

        for (var i = 0, len = entities.length; i < len; i++) {
            var entity = entities[i];
            var particleSystemGraphics = entity._particleSystem;

            var particleSystem = particleHash[entity.id];
            var show = entity.isShowing && entity.isAvailable(time) && Property.getValueOrDefault(particleSystemGraphics._show, time, true);

            var modelMatrix;
            if (show) {
                modelMatrix = entity._getModelMatrix(time, modelMatrixScratch);
                show = defined(modelMatrix);
            }

            // TODO:
            /*
            if (!show) {
                if (defined(modelData)) {
                    particleSystem.show = false;
                }
                continue;
            }
            */

            if (!defined(particleSystem)) {
                particleSystem = new ParticleSystem();
                particleSystem.id = entity;
                primitives.add(particleSystem);
                particleHash[entity.id] = particleSystem;
            }

            particleSystem.show = true;
            particleSystem.image = Property.getValueOrUndefined(particleSystemGraphics._image, time);
            particleSystem.emitter = Property.getValueOrDefault(particleSystemGraphics._emitter, time, defaultEmitter);
            particleSystem.startScale = Property.getValueOrDefault(particleSystemGraphics._startScale, time, defaultStartScale);
            particleSystem.endScale = Property.getValueOrDefault(particleSystemGraphics._endScale, time, defaultEndScale);
            particleSystem.startColor = Property.getValueOrDefault(particleSystemGraphics._startColor, time, defaultStartColor);
            particleSystem.endColor = Property.getValueOrDefault(particleSystemGraphics._endColor, time, defaultEndColor);
            particleSystem.rate = Property.getValueOrDefault(particleSystemGraphics._rate, time, defaultRate);
            particleSystem.minWidth = Property.getValueOrDefault(particleSystemGraphics._minWidth, time, defaultMinWidth);
            particleSystem.maxWidth = Property.getValueOrDefault(particleSystemGraphics._maxWidth, time, defaultMaxWidth);
            particleSystem.minHeight = Property.getValueOrDefault(particleSystemGraphics._minHeight, time, defaultMinHeight);
            particleSystem.maxHeight = Property.getValueOrDefault(particleSystemGraphics._maxHeight, time, defaultMaxHeight);
            particleSystem.minSpeed = Property.getValueOrDefault(particleSystemGraphics._minSpeed, time, defaultMinSpeed);
            particleSystem.maxSpeed = Property.getValueOrDefault(particleSystemGraphics._maxSpeed, time, defaultMaxSpeed);
            particleSystem.minLife = Property.getValueOrDefault(particleSystemGraphics._minLife, time, defaultMinLife);
            particleSystem.maxLife = Property.getValueOrDefault(particleSystemGraphics._maxLife, time, defaultMaxLife);
            particleSystem.lifeTime = Property.getValueOrDefault(particleSystemGraphics._lifeTime, time, defaultLifeTime);
            particleSystem.loop = Property.getValueOrDefault(particleSystemGraphics._loop, time, defaultLoop);
            particleSystem.emitterModelMatrix = Property.getValueOrDefault(particleSystemGraphics._emitterModelMatrix, time, defaultEmitterModelMatrix);
            particleSystem.bursts = Property.getValueOrUndefined(particleSystemGraphics._bursts, time);

            particleSystem.modelMatrix = modelMatrix;
        }

        return true;
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     *
     * @returns {Boolean} True if this object was destroyed; otherwise, false.
     */
    ParticleSystemVisualizer.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Removes and destroys all primitives created by this instance.
     */
    ParticleSystemVisualizer.prototype.destroy = function() {
        this._entityCollection.collectionChanged.removeEventListener(ParticleSystemVisualizer.prototype._onCollectionChanged, this);
        var entities = this._entitiesToVisualize.values;
        var particleHash = this._particleHash;
        var primitives = this._primitives;
        for (var i = entities.length - 1; i > -1; i--) {
            removeParticleSystem(this, entities[i], particleHash, primitives);
        }
        return destroyObject(this);
    };

    /**
     * Computes a bounding sphere which encloses the visualization produced for the specified entity.
     * The bounding sphere is in the fixed frame of the scene's globe.
     *
     * @param {Entity} entity The entity whose bounding sphere to compute.
     * @param {BoundingSphere} result The bounding sphere onto which to store the result.
     * @returns {BoundingSphereState} BoundingSphereState.DONE if the result contains the bounding sphere,
     *                       BoundingSphereState.PENDING if the result is still being computed, or
     *                       BoundingSphereState.FAILED if the entity has no visualization in the current scene.
     * @private
     */
    ParticleSystemVisualizer.prototype.getBoundingSphere = function(entity, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(entity)) {
            throw new DeveloperError('entity is required.');
        }
        if (!defined(result)) {
            throw new DeveloperError('result is required.');
        }
        //>>includeEnd('debug');

        var particleSystem = this._particleHash[entity.id];
        if (!defined(particleSystem) || !particleSystem.show) {
            return BoundingSphereState.FAILED;
        }

        Matrix4.multiplyByPoint(particleSystem.modelMatrix, Cartesian3.ZERO, result.center);
        result.radius = 0.0;
        return BoundingSphereState.DONE;
    };

    /**
     * @private
     */
    ParticleSystemVisualizer.prototype._onCollectionChanged = function(entityCollection, added, removed, changed) {
        var i;
        var entity;
        var entities = this._entitiesToVisualize;
        var particleHash = this._particleHash;
        var primitives = this._primitives;

        for (i = added.length - 1; i > -1; i--) {
            entity = added[i];
            if (defined(entity._particleSystem) && defined(entity._position)) {
                entities.set(entity.id, entity);
            }
        }

        for (i = changed.length - 1; i > -1; i--) {
            entity = changed[i];
            if (defined(entity._particleSystem) && defined(entity._position)) {
                entities.set(entity.id, entity);
            } else {
                removeParticleSystem(this, entity, particleHash, primitives);
                entities.remove(entity.id);
            }
        }

        for (i = removed.length - 1; i > -1; i--) {
            entity = removed[i];
            removeParticleSystem(this, entity, particleHash, primitives);
            entities.remove(entity.id);
        }
    };

    function removeParticleSystem(visualizer, entity, particleHash, primitives) {
        var particleSystem = particleHash[entity.id];
        if (defined(particleSystem)) {
            primitives.removeAndDestroy(particleSystem);
            delete particleHash[entity.id];
        }
    }

    return ParticleSystemVisualizer;
});
