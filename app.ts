class Vector {
    constructor(public x: number, public y: number) { }
    scale(k: number) { return new Vector(k * this.x, k * this.y); }
    subtract(v: Vector) { return new Vector(this.x - v.x, this.y - v.y); }
    add(v: Vector) { return new Vector(this.x + v.x, this.y + v.y); }
    dot(v: Vector) { return this.x * v.x + this.y * v.y; }
    norm() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    norm2() { return this.x * this.x + this.y * this.y; }
    unit() {
        var mag = this.norm();
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return this.scale(div);
    }
    cross(v: Vector) { return this.x * v.y - this.y * v.x; }
    equal(v: Vector) { return this.x == v.x && this.y == v.y; }
    rotate(ang: number) { return new Vector(this.x * Math.cos(ang) - this.y * Math.sin(ang), this.y * Math.cos(ang) + this.x * Math.sin(ang)); }
    toString() { return "{" + this.x.toString + ", " + this.y.toString + ")"; }
}

class PolygonShape {
    points: Vector[];
    area: number;
    moment: number;

    constructor(points: Vector[]) {
        this.set_properties(points);
    }

    private set_properties(points: Vector[]) {
        var area = 0.0;
        var moment = 0.0;
        var centroid = new Vector(0.0, 0.0);
        for (var i = 0; i < points.length - 1; ++i) {
            var start = points[i];
            var end = points[i + 1];
            var c = start.cross(end);
            area += c;
            centroid = centroid.add(start.add(end).scale(c));
            moment += (start.norm2() + end.norm2() + start.dot(end)) * c;
        }
        if (area != 0) {
            area /= 2;
            centroid = centroid.scale(1.0 / (area * 6));
            moment = (moment / 12) - area * centroid.norm2(); // Steiner's rule so the moment is with respect to the centroid
        }
        this.area = Math.abs(area);
        this.moment = Math.abs(moment);
        this.points = points.map(function (p) { return p.subtract(centroid); })
    }

    point_inside(point: Vector): bool {
        var count = 0;
        for (var i = 0; i < this.points.length - 1; ++i) {
            var start = this.points[i];
            var end = this.points[i + 1];
            if ((start.y - point.y) * (end.y - point.y) < 0) {
                if (Math.abs(end.y - start.y) > 1e-10) {
                    var m = (end.x - start.x)/(end.y - start.y)
                    if (start.x + (point.y - start.y) * m > point.x) ++count;
                } else ++count;
            }
        }
        return count % 2 == 1;
    }
}

class Collision { 
    constructor(public ast1: Asteroid, public ast2: Asteroid, public point: Vector, public normal: Vector) { }
}

class SpaceShip {
    alive: bool;
    death_time: number = 1;
    death_time_current: number;
    shape: PolygonShape;
    position: Vector;
    rotation: number;
    velocity: Vector;
    max_speed: number = 150;
    acceleration: number = 10000;
    friction: number = 0.6;
    is_accelerating: bool = false;
    is_rotating: number = 0;
    rotation_speed: number = 4;

    constructor(game: AsteroidsGame) {
        var points = new Vector[];
        points.push(new Vector(10, 0), new Vector(0, 30), new Vector(-10, 0));
        this.shape = new PolygonShape(points)
        this.position = game.fieldsize.scale(0.5);
        this.rotation = Math.PI;
        this.velocity = new Vector(0, 0);
    }
    
    point_inside(point: Vector): bool {
        return this.shape.point_inside(point.subtract(this.position).rotate(-this.rotation));
    }

    collides(ast: Asteroid): bool {
        for (var i = 0; i < this.shape.points.length; ++i) {
            var point = this.shape.points[i].rotate(this.rotation).add(this.position);
            if (ast.point_inside(point)) return true;
        }
        for (var i = 0; i < ast.shape.points.length; ++i) {
            var point = ast.shape.points[i].rotate(ast.rotation).add(ast.position);
            if (this.point_inside(point)) return true;
        }
        return false;
    }

    update(dt: number, fieldsize: Vector, margin: number) {
        this.position = this.position.add(this.velocity.scale(dt));
        if (this.position.x < -margin) this.position.x += fieldsize.x + 2 * margin;
        else if (this.position.x > fieldsize.x + margin) this.position.x -= fieldsize.x + 2 * margin;
        if (this.position.y < -margin) this.position.y += fieldsize.y + 2 * margin;
        else if (this.position.y > fieldsize.y + margin) this.position.y -= fieldsize.y + 2 * margin;

        if (this.is_accelerating) {
            this.velocity = this.velocity.add(new Vector(-Math.sin(this.rotation), Math.cos(this.rotation)).scale(this.acceleration * dt * dt));
            var speed = this.velocity.norm();
            if (speed > this.max_speed) {
                this.velocity = this.velocity.scale(this.max_speed / speed);
            }
        } else {
            this.velocity = this.velocity.scale((1 - this.friction* dt));
        }
        this.rotation += this.rotation_speed * this.is_rotating*dt;
        
    }

    shoot(): Shot {
        var position = this.position.add(this.shape.points[1].rotate(this.rotation));
        var direction = position.subtract(this.position).unit();
        var lifetime = 1.0;
        return new Shot(position, direction, lifetime);
    }
}

class Particle {
    constructor(public position: Vector,
                public lin_velocity: Vector,
                public rotation: number,
                public ang_velocity: number,
                public lifetime: number) { }
    
    update(dt: number, fieldsize: Vector, margin: number) {
        this.position = this.position.add(this.lin_velocity.scale(dt));
        if (this.position.x < -margin) this.position.x += fieldsize.x + 2 * margin;
        else if (this.position.x > fieldsize.x + margin) this.position.x -= fieldsize.x + 2 * margin;
        if (this.position.y < -margin) this.position.y += fieldsize.y + 2 * margin;
        else if (this.position.y > fieldsize.y + margin) this.position.y -= fieldsize.y + 2 * margin;

        this.rotation = this.rotation + dt * this.ang_velocity;
        this.lifetime -= dt;
    }
}

class Shot {
    shot_speed: number = 400;
    constructor(public position: Vector, public direction: Vector, public lifetime: number) { }

    update(dt: number, fieldsize: Vector, margin: number) {
        this.position = this.position.add(this.direction.scale(this.shot_speed*dt));
        if (this.position.x < -margin) this.position.x += fieldsize.x + 2 * margin;
        else if (this.position.x > fieldsize.x + margin) this.position.x -= fieldsize.x + 2 * margin;
        if (this.position.y < -margin) this.position.y += fieldsize.y + 2 * margin;
        else if (this.position.y > fieldsize.y + margin) this.position.y -= fieldsize.y + 2 * margin;

        this.lifetime -= dt;
    }
}

class Asteroid {

    constructor(public shape: PolygonShape,
                public position: Vector,
                public rotation: number,
                public lin_velocity: Vector,
                public ang_velocity: number,
                public level: number) { }

    update(dt: number, fieldsize: Vector, margin: number) {
        this.position = this.position.add(this.lin_velocity.scale(dt));
        if (this.position.x < -margin) this.position.x += fieldsize.x + 2 * margin;
        else if (this.position.x > fieldsize.x + margin) this.position.x -= fieldsize.x + 2 * margin;
        if (this.position.y < -margin) this.position.y += fieldsize.y + 2 * margin;
        else if (this.position.y > fieldsize.y + margin) this.position.y -= fieldsize.y + 2 * margin;

        this.rotation = this.rotation + dt * this.ang_velocity;
    }

    collides(ast: Asteroid): Collision {
        var points1 = this.shape.points.map((p: Vector) => { return p.rotate(this.rotation).add(this.position); });
        var points2 = ast.shape.points.map((p: Vector) => { return p.rotate(ast.rotation).add(ast.position); });
        for (var i = 0; i < points1.length - 1; ++i) {
            if (ast.point_inside(points1[i])) {
                var colision_point = this.closest_point_in_polygon(points1[i], points2);
                var normal: Vector = points1[i].subtract(colision_point).unit();
                return new Collision(this, ast, colision_point, normal);
            }
        }
        for (var i = 0; i < points2.length - 1; ++i) {
            if (this.point_inside(points2[i])) {
                var colision_point = this.closest_point_in_polygon(points2[i], points1);
                var normal: Vector = points2[i].subtract(colision_point).unit();
                return new Collision(ast, this, colision_point, normal);
            }
        }
        return null;
    }

    point_inside(point: Vector): bool {
        return this.shape.point_inside(point.subtract(this.position).rotate(-this.rotation));
    }

    private closest_point_in_polygon(point: Vector, ppoints: Vector[]): Vector {
        var distance = Number.MAX_VALUE;
        var closest = new Vector(0, 0);
        for (var i = 0; i < ppoints.length - 1; ++i) {
            var start = ppoints[i];
            var end = ppoints[i + 1];
            var closest_aux = this.closest_point_in_segment(point, start, end);
            var dist_aux = closest_aux.subtract(point).norm();
            if (dist_aux < distance) {
                distance = dist_aux;
                closest = closest_aux.scale(1);
            }
        }
        return closest;
    }

    private closest_point_in_segment(point: Vector, start: Vector, end: Vector): Vector {
        var t = end.subtract(start);
        var n = t.norm();
        t = t.scale(1/n);
        var v = point.subtract(start);
        var p = v.dot(t);
        if (p < 0) return start;
        else if (p > n) return end;
        else return start.add(t.scale(p));
    }
}

class AsteroidsGame {
    gameover: bool;
    fieldsize = new Vector(600, 400);
    margin = 40;
    canvas: HTMLCanvasElement;
    asteroids: Asteroid[];
    ship: SpaceShip;
    shots: Shot[];
    particles: Particle[];
    score: number;
    lives: number;
    renderer: AsteroidsRenderer;
    fps: number = 60;
    refresh_interval: number;
    time: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.canvas.width = this.fieldsize.x;
        this.canvas.height = this.fieldsize.y;
        this.renderer = new ClassicAsteroidsRenderer;
    }

    start() {
        this.score = 0;
        this.lives = 3;
        this.gameover = false;
        this.asteroids = new Asteroid[];
        this.shots = new Shot[];
        this.time = 0.0;
        this.particles = new Particle[];
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x/3, -this.margin), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x/3*2, this.fieldsize.y + this.margin), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(-this.margin, this.fieldsize.y*2/3), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x + this.margin, this.fieldsize.y/3), 3));
        this.ship = new SpaceShip(this);
        this.ship.alive = true;
        
        var dt = 1.0 / this.fps;
        this.refresh_interval = setInterval(() => this.run(), dt * 1000);
    }

    stop() {
        clearInterval(this.refresh_interval);
    }

    private run() {
        var dt = 1.0 / this.fps;
        this.update(dt);
        this.renderer.render(this);
    }

    private update(dt: number) {
        this.time += dt;
        this.asteroids.forEach((a: Asteroid) => a.update(dt, this.fieldsize, this.margin));
        this.shots.forEach((s: Shot) => s.update(dt, this.fieldsize, this.margin));
        this.shots = this.shots.filter((s: Shot) => { return s.lifetime > 0; });
        this.particles.forEach((p: Particle) => p.update(dt, this.fieldsize, this.margin));
        this.particles = this.particles.filter((p: Particle) => { return p.lifetime > 0; });
        this.check_shots();
        this.check_asteroid_collisions();

        if (this.ship.alive) {
            this.ship.update(dt, this.fieldsize, this.margin);
            this.check_ship_collisions();
        } else {
            this.ship.death_time_current -= dt;
            if (this.ship.death_time_current < 0 && !this.gameover) {
                this.ship = new SpaceShip(this);
                this.ship.alive = true;
            }
        }
        // if too few asteroids add more
        var sum_levels = 0;
        for (var i = 0; i < this.asteroids.length; ++i) sum_levels += this.asteroids[i].level;
        var max_levels = 10 + Math.log(this.time) * 2;
        if (sum_levels < max_levels && !this.gameover) {
            var position: Vector; 
            if (Math.random() > 0.5) {
                position = new Vector(Math.round(Math.random()) * (this.fieldsize.x + 2 * this.margin) - this.margin, Math.random() * this.fieldsize.y);
            } else {
                position = new Vector(Math.random() * this.fieldsize.x, Math.round(Math.random()) * (this.fieldsize.y + 2 * this.margin) - this.margin);
            }
            this.asteroids.push(this.generate_asteroid(position, 3));
        }
    }

    private generate_asteroid(position: Vector, level: number): Asteroid {
        var points = [];
        var radius = 10 * Math.pow(2, level - 1);
        var num_vertices = 12;
        for (var i = 0; i < num_vertices; ++i) {
            var r = radius - 0.9 * radius * Math.random()*Math.random()*Math.random();
            var ang = i * 2 * Math.PI / num_vertices;
            points.push(new Vector(r*Math.cos(ang), r*Math.sin(ang)));
        }
        points.push(points[0]);
        var poly = new PolygonShape(points);
        var speed = 50 + Math.random()*50;
        return new Asteroid(poly, position, 0, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), 2*(Math.random() - 0.5), level);
    }

    private check_shots() {
        for (var i = this.shots.length - 1; i >= 0; --i) {
            for (var j = this.asteroids.length - 1; j >= 0; --j) {
                if (this.asteroids[j].point_inside(this.shots[i].position)) {
                    this.score += 10*Math.pow(2, this.asteroids[j].level - 1);
                    var rem_asteroid = this.asteroids[j];
                    var rem_shot = this.shots[i];
                    if (rem_asteroid.level > 1) {
                        var level = rem_asteroid.level - 1;
                        var radius = 10 * Math.pow(2, level);
                        var p1 = rem_asteroid.position.add(rem_shot.direction.rotate(Math.PI / 2).scale(radius));
                        var p2 = rem_asteroid.position.add(rem_shot.direction.rotate(-Math.PI / 2).scale(radius));
                        this.asteroids.push(this.generate_asteroid(p1, level));
                        this.asteroids.push(this.generate_asteroid(p2, level));
                    }
                    this.asteroids.splice(j, 1)
                    this.shots.splice(i, 1);
                    break;
                }
            }
        }
    }

    private check_asteroid_collisions() {
        for (var i = 0; i < this.asteroids.length; ++i) {
            var r1 = 10 * Math.pow(2, this.asteroids[i].level - 1);
            for (var j = i + 1; j < this.asteroids.length; ++j) {
                var r2 = 10 * Math.pow(2, this.asteroids[j].level - 1);
                var dist = this.asteroids[i].position.subtract(this.asteroids[j].position).norm();
                if (dist < r1 + r2) {
                    var collision = this.asteroids[i].collides(this.asteroids[j]);
                    if (!(collision == null)) {
                        this.handle_collision(collision);
                    }
                }
            }
        }
    }

    private handle_collision(collision: Collision) {
        var r1c = collision.point.subtract(collision.ast1.position);
        var r1ct = r1c.rotate(Math.PI/2);
        var r2c = collision.point.subtract(collision.ast2.position);
        var r2ct = r2c.rotate(Math.PI/2);
        var v1c = collision.ast1.lin_velocity.add(r1ct.scale(collision.ast1.ang_velocity));
        var v2c = collision.ast2.lin_velocity.add(r2ct.scale(collision.ast2.ang_velocity));
        var v12c = v2c.subtract(v1c).dot(collision.normal);
        if (v12c < 0) {
            var e = 1;
            var m1 = collision.ast1.shape.area;
            var m2 = collision.ast2.shape.area;
            var i1 = collision.ast1.shape.moment;
            var i2 = collision.ast2.shape.moment;
            var r1ctn = r1ct.dot(collision.normal);
            var r2ctn = r2ct.dot(collision.normal);
            var vn = v1c.subtract(v2c).dot(collision.normal);
            var j = (1 + e) * vn / ((1 / m1) + (1 / m2) + r1ctn * r1ctn/ i1 + r2ctn * r2ctn / i2);
            collision.ast1.lin_velocity = collision.ast1.lin_velocity.subtract(collision.normal.scale(j / m1));
            collision.ast1.ang_velocity -= j * r1ctn/i1;
            collision.ast2.lin_velocity = collision.ast2.lin_velocity.add(collision.normal.scale(j / m2));
            collision.ast2.ang_velocity += j * r2ctn/ i2 ;
        }

    }

    private check_ship_collisions() {
        for (var i = 0; i < this.asteroids.length; ++i) {
            if (this.ship.collides(this.asteroids[i])) {
                this.lives--;
                this.ship.alive = false;
                this.ship.death_time_current = this.ship.death_time;

                for (var i = 0; i < 20; ++i) {
                    var speed = 50 + Math.random() * 50;
                    this.particles.push(new Particle(this.ship.position, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), Math.random()*Math.PI, 5 * (Math.random() - 0.5), 0.5+ Math.random()*0.5));
                }
                if (this.lives <= 0) {
                    this.gameover = true;
                    for (var j = 0; j < this.asteroids.length; ++j) {
                        var num_particles = 20 * Math.pow(2, this.asteroids[j].level - 1);
                        var radius = 10 * Math.pow(2, this.asteroids[j].level - 1);
                        for (var i = 0; i < num_particles; ++i) {
                            var speed = 50 + Math.random() * 50;
                            var position = this.asteroids[j].position.add(new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(radius));
                            this.particles.push(new Particle(position, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), Math.random() * Math.PI, 5 * (Math.random() - 0.5), 1 + Math.random() * 1));
                        }
                    }
                    this.asteroids = new Asteroid[];
                }
            }
        }
    }
}

interface AsteroidsRenderer {
    render(game: AsteroidsGame);
}

class ClassicAsteroidsRenderer implements AsteroidsRenderer {
    render(game: AsteroidsGame) {
        var context = game.canvas.getContext("2d");
        context.fillStyle="#000000";
        context.fillRect(0, 0, game.fieldsize.x, game.fieldsize.y);
        for (var i = 0; i < game.asteroids.length; ++i) {
            this.render_asteroid(context, game.asteroids[i]);
        }
        if (game.ship.alive) this.render_ship(context, game.ship);
        for (var i = 0; i < game.shots.length; ++i) {
            this.render_shot(context, game.shots[i]);
        }
        for (var i = 0; i < game.particles.length; ++i) {
            this.render_particle(context, game.particles[i]);
        }
        //Score and lives
        context.fillStyle = "#FFFFFF";
        if (game.gameover) {
            context.font = "40px Verdana";
            context.textAlign = "center";
            context.fillText("GAME OVER", (game.fieldsize.x / 2), (game.fieldsize.y / 2));
            context.fillText("SCORE: " + game.score.toFixed(0), (game.fieldsize.x / 2), (game.fieldsize.y / 2) + 50);
            context.font = "20px Verdana";
            context.fillText("Shoot to start again", (game.fieldsize.x / 2), (game.fieldsize.y / 2) + 100);
        } else {
            context.textAlign = "left";
            context.font = "20px Verdana";
            context.fillText("SCORE: " + game.score.toFixed(0), 20, 30);
            context.textAlign = "right";
            context.fillText("LIVES: " + game.lives.toFixed(0), game.fieldsize.x - 20, 30);
        }
    }

    render_asteroid(context: CanvasRenderingContext2D, asteroid: Asteroid) {
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.translate(asteroid.position.x, asteroid.position.y);
        context.rotate(asteroid.rotation);
        context.beginPath();
        context.moveTo(asteroid.shape.points[0].x, asteroid.shape.points[0].y);
        for (var i = 1; i < asteroid.shape.points.length; ++i)
            context.lineTo(asteroid.shape.points[i].x, asteroid.shape.points[i].y);
        context.closePath();
        context.stroke();
        context.rotate(-asteroid.rotation);
        context.translate(-asteroid.position.x, -asteroid.position.y);
    }

    render_ship(context: CanvasRenderingContext2D, ship: SpaceShip) {
        var p = ship.shape.points;
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.translate(ship.position.x, ship.position.y);
        context.rotate(ship.rotation);
        context.beginPath();
        context.moveTo(p[0].x, p[0].y);
        for (var i = 1; i < p.length; ++i)
            context.lineTo(p[i].x, p[i].y);
        context.stroke();
        var p1 = p[0].add(p[1].subtract(p[0]).scale(0.2));
        var p2 = p[2].add(p[1].subtract(p[2]).scale(0.2));
        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.stroke();
        if (ship.is_accelerating) {
            
            var p3 = new Vector(0.5 * (p1.x + p2.x), p1.y - 10);
            context.beginPath();
            context.moveTo(p1.x - 3, p1.y);
            context.lineTo(p3.x, p3.y);
            context.lineTo(p2.x + 3, p2.y);
            context.stroke();
        }
        context.rotate(-ship.rotation);
        context.translate(-ship.position.x, -ship.position.y);
    }

    render_particle(context: CanvasRenderingContext2D, particle: Particle) {
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.translate(particle.position.x, particle.position.y);
        context.rotate(particle.rotation);
        context.beginPath();
        context.moveTo(-2, 0);
        context.lineTo(2, 0);
        context.stroke();
        context.rotate(-particle.rotation);
        context.translate(-particle.position.x, -particle.position.y);
    }

    render_shot(context: CanvasRenderingContext2D, shot: Shot) {
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(shot.position.x, shot.position.y);
        var p = shot.position.add(shot.direction.scale(5));
        context.lineTo(p.x, p.y);
        context.stroke();
    }
}

var asteroids_app: AsteroidsGame;

function start() {
    var canvas = <HTMLCanvasElement> document.getElementById('canvas');
    asteroids_app = new AsteroidsGame(canvas);
    asteroids_app.start();
}

window.onload = start;

window.onkeydown = (ev: KeyboardEvent) => {
    switch (ev.keyCode) {
        case 38: // Up
            if (asteroids_app.ship.alive) asteroids_app.ship.is_accelerating = true;
            break;
        case 39: // Right
            if (asteroids_app.ship.alive && asteroids_app.ship.is_rotating < 1)
                asteroids_app.ship.is_rotating++;
            break;
        case 37: // Left
            if (asteroids_app.ship.alive && asteroids_app.ship.is_rotating > -1)
                asteroids_app.ship.is_rotating--;
            break;
    }
};

window.onkeyup = (ev: KeyboardEvent) => {
    switch (ev.keyCode) {
        case 38: // Up
            if (asteroids_app.ship.alive) asteroids_app.ship.is_accelerating = false;
            break;
        case 39: // Right
            if (asteroids_app.ship.alive && asteroids_app.ship.is_rotating > -1)
                asteroids_app.ship.is_rotating--;
            break;
        case 37: // Left
            if (asteroids_app.ship.alive && asteroids_app.ship.is_rotating < 1)
                asteroids_app.ship.is_rotating++;
            break;
        case 32: // Space
            if (asteroids_app.gameover) {
                asteroids_app.stop();
                start();
            } else {
                if (asteroids_app.ship.alive) asteroids_app.shots.push(asteroids_app.ship.shoot());
            }
            break;
    }
};