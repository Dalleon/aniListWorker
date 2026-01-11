class Body {
    /**
     * @param {number} posX - X position of the Body
     * @param {number} posY - Y position of the Body
     * @param {number} rotation - Rotation of the Body
     */
    constructor() {
        this.posX = 0;
        this.posY = 0;
        this.rotation = 0;

        this.veloX = 0;
        this.veloY = 0;
        this.rotVelo = 0;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.posX, this.posY);
        ctx.rotate((this.rotation * Math.PI) / 180);

        ctx.fillStyle = 'red';
        ctx.fillRect(-8, -8, 16, 16);

        ctx.restore();
    }
}

export default Body