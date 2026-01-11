import Body from './Body.js'

const X_MASK     = 0b1111111;       // 7 bits
const Y_MASK     = 0b1111111;       // 7 bits
const ROT_MASK   = 0b11;            // 2 bits
const FLIP_MASK  = 0b1;             // 1 bit
const BLOCK_MASK = 0b111111111111111; // 15 bits

const X_SHIFT     = 25;
const Y_SHIFT     = 18;
const ROT_SHIFT   = 16;
const FLIP_SHIFT  = 15;
const BLOCK_SHIFT = 0;

const MAX_BLOCKS = 128*128;
class BlockBody extends Body {
    constructor() {
        super();
        
        // Packed block data: [7 xPos][7 yPos][2 rot][1 flip][15 blockId] -> 32 bits each
        this.data = new Uint32Array(MAX_BLOCKS); // list of blocks (max is 128x128)
        this.length = 0;
    }
    
    /** Pack block properties into a 32-bit integer */
    static packBlock(x, y, rot, flip, blockId) {
        return ((x & X_MASK) << X_SHIFT) |
               ((y & Y_MASK) << Y_SHIFT) |
               ((rot & ROT_MASK) << ROT_SHIFT) |
               ((flip & FLIP_MASK) << FLIP_SHIFT) |
               ((blockId & BLOCK_MASK) << BLOCK_SHIFT);
    }

    /** Unpack a 32-bit integer into block properties */
    static unpackBlock(data) {
        return {
            x: (data >> X_SHIFT) & X_MASK,
            y: (data >> Y_SHIFT) & Y_MASK,
            rot: (data >> ROT_SHIFT) & ROT_MASK,
            flip: (data >> FLIP_SHIFT) & FLIP_MASK,
            blockId: (data >> BLOCK_SHIFT) & BLOCK_MASK
        };
    }

    /** Place a block at (x, y) with optional rotation, flip, and blockId */
    placeBlock(x, y, blockId = 0, rot = 0, flip = 0) {
        if (this.length >= this.data.length) {
            throw new Error("BlockBody: Maximum block limit reached");
        }
        const packed = BlockBody.packBlock(x, y, rot, flip, blockId);
        this.data[this.length++] = packed;
    }

    /** Remove a block at (x, y) */
    removeBlock(x, y) {
        for (let i = 0; i < this.length; i++) {
            const { x: bx, y: by } = BlockBody.unpackBlock(this.data[i]);
            if (bx === x && by === y) {
                this.data[i] = this.data[this.length - 1]; // swap with last
                this.length--;
                return true;
            }
        }
        return false;
    }

    /** Get block at (x, y) */
    getBlock(x, y) {
        for (let i = 0; i < this.length; i++) {
            const block = BlockBody.unpackBlock(this.data[i]);
            if (block.x === x && block.y === y) return block;
        }
        return null;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.posX, this.posY);
        ctx.rotate((this.rotation * Math.PI) / 180);

        for (let i = 0; i < this.length; i++) {
            const { x, y, rot, flip, blockId } = BlockBody.unpackBlock(this.data[i]);
            ctx.fillStyle = 'blue';
            ctx.fillRect(x * 16 - 8, y * 16 - 8, 16, 16);
        }

        ctx.restore();
    }
}

export default BlockBody