import Body from './Body.js';

class World {
    constructor() {
        this.bodies = [];
    }

    /**
     * Add a Body to the world
     * @param {Body} body 
     */
    addBody(body) {
        this.bodies.push(body);
    }

    /**
     * Update all bodies in the world
     * @param {number} deltaTime - time step in seconds
     */
    update(deltaTime) {
        for (const body of this.bodies) {
            body.posX += body.veloX * deltaTime;
            body.posY += body.veloY * deltaTime;
            body.rotation += body.rotVelo * deltaTime;
            body.rotation %= 360;
        }
    }

    render(ctx) {
        for (const body of this.bodies) {
            body.render(ctx)
        }
    }
}

export default World;