var Vector = (function () {
    function Vector(x, y) {
        this.x = x;
        this.y = y;
    }
    Vector.prototype.scale = function (k) {
        return new Vector(k * this.x, k * this.y);
    };
    Vector.prototype.subtract = function (v) {
        return new Vector(this.x - v.x, this.y - v.y);
    };
    Vector.prototype.add = function (v) {
        return new Vector(this.x + v.x, this.y + v.y);
    };
    Vector.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y;
    };
    Vector.prototype.norm = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };
    Vector.prototype.norm2 = function () {
        return this.x * this.x + this.y * this.y;
    };
    Vector.prototype.unit = function () {
        var mag = this.norm();
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return this.scale(div);
    };
    Vector.prototype.cross = function (v) {
        return this.x * v.y - this.y * v.x;
    };
    Vector.prototype.equal = function (v) {
        return this.x == v.x && this.y == v.y;
    };
    Vector.prototype.rotate = function (ang) {
        return new Vector(this.x * Math.cos(ang) - this.y * Math.sin(ang), this.y * Math.cos(ang) + this.x * Math.sin(ang));
    };
    Vector.prototype.toString = function () {
        return "{" + this.x.toString + ", " + this.y.toString + ")";
    };
    return Vector;
})();
var PolygonShape = (function () {
    function PolygonShape(points) {
        this.set_properties(points);
    }
    PolygonShape.prototype.set_properties = function (points) {
        var area = 0.0;
        var moment = 0.0;
        var centroid = new Vector(0.0, 0.0);
        for(var i = 0; i < points.length - 1; ++i) {
            var start = points[i];
            var end = points[i + 1];
            var c = start.cross(end);
            area += c;
            centroid = centroid.add(start.add(end).scale(c));
            moment += (start.norm2() + end.norm2() + start.dot(end)) * c;
        }
        if(area != 0) {
            area /= 2;
            centroid = centroid.scale(1.0 / (area * 6));
            moment = (moment / 12) - area * centroid.norm2();
        }
        this.area = Math.abs(area);
        this.moment = Math.abs(moment);
        this.points = points.map(function (p) {
            return p.subtract(centroid);
        });
    };
    PolygonShape.prototype.point_inside = function (point) {
        var count = 0;
        for(var i = 0; i < this.points.length - 1; ++i) {
            var start = this.points[i];
            var end = this.points[i + 1];
            if((start.y - point.y) * (end.y - point.y) < 0) {
                if(Math.abs(end.y - start.y) > 1e-10) {
                    var m = (end.x - start.x) / (end.y - start.y);
                    if(start.x + (point.y - start.y) * m > point.x) {
                        ++count;
                    }
                } else {
                    ++count;
                }
            }
        }
        return count % 2 == 1;
    };
    return PolygonShape;
})();
var Collision = (function () {
    function Collision(ast1, ast2, point, normal) {
        this.ast1 = ast1;
        this.ast2 = ast2;
        this.point = point;
        this.normal = normal;
    }
    return Collision;
})();
var SpaceShip = (function () {
    function SpaceShip(game) {
        this.death_time = 1;
        this.max_speed = 150;
        this.acceleration = 10000;
        this.friction = 0.6;
        this.is_accelerating = false;
        this.is_rotating = 0;
        this.rotation_speed = 4;
        var points = new Array();
        points.push(new Vector(10, 0), new Vector(0, 30), new Vector(-10, 0));
        this.shape = new PolygonShape(points);
        this.position = game.fieldsize.scale(0.5);
        this.rotation = Math.PI;
        this.velocity = new Vector(0, 0);
    }
    SpaceShip.prototype.point_inside = function (point) {
        return this.shape.point_inside(point.subtract(this.position).rotate(-this.rotation));
    };
    SpaceShip.prototype.collides = function (ast) {
        for(var i = 0; i < this.shape.points.length; ++i) {
            var point = this.shape.points[i].rotate(this.rotation).add(this.position);
            if(ast.point_inside(point)) {
                return true;
            }
        }
        for(var i = 0; i < ast.shape.points.length; ++i) {
            var point = ast.shape.points[i].rotate(ast.rotation).add(ast.position);
            if(this.point_inside(point)) {
                return true;
            }
        }
        return false;
    };
    SpaceShip.prototype.update = function (dt, fieldsize, margin) {
        this.position = this.position.add(this.velocity.scale(dt));
        if(this.position.x < -margin) {
            this.position.x += fieldsize.x + 2 * margin;
        } else {
            if(this.position.x > fieldsize.x + margin) {
                this.position.x -= fieldsize.x + 2 * margin;
            }
        }
        if(this.position.y < -margin) {
            this.position.y += fieldsize.y + 2 * margin;
        } else {
            if(this.position.y > fieldsize.y + margin) {
                this.position.y -= fieldsize.y + 2 * margin;
            }
        }
        if(this.is_accelerating) {
            this.velocity = this.velocity.add(new Vector(-Math.sin(this.rotation), Math.cos(this.rotation)).scale(this.acceleration * dt * dt));
            var speed = this.velocity.norm();
            if(speed > this.max_speed) {
                this.velocity = this.velocity.scale(this.max_speed / speed);
            }
        } else {
            this.velocity = this.velocity.scale((1 - this.friction * dt));
        }
        this.rotation += this.rotation_speed * this.is_rotating * dt;
    };
    SpaceShip.prototype.shoot = function () {
        var position = this.position.add(this.shape.points[1].rotate(this.rotation));
        var direction = position.subtract(this.position).unit();
        var lifetime = 1.0;
        return new Shot(position, direction, lifetime);
    };
    return SpaceShip;
})();
var Particle = (function () {
    function Particle(position, lin_velocity, rotation, ang_velocity, lifetime) {
        this.position = position;
        this.lin_velocity = lin_velocity;
        this.rotation = rotation;
        this.ang_velocity = ang_velocity;
        this.lifetime = lifetime;
    }
    Particle.prototype.update = function (dt, fieldsize, margin) {
        this.position = this.position.add(this.lin_velocity.scale(dt));
        if(this.position.x < -margin) {
            this.position.x += fieldsize.x + 2 * margin;
        } else {
            if(this.position.x > fieldsize.x + margin) {
                this.position.x -= fieldsize.x + 2 * margin;
            }
        }
        if(this.position.y < -margin) {
            this.position.y += fieldsize.y + 2 * margin;
        } else {
            if(this.position.y > fieldsize.y + margin) {
                this.position.y -= fieldsize.y + 2 * margin;
            }
        }
        this.rotation = this.rotation + dt * this.ang_velocity;
        this.lifetime -= dt;
    };
    return Particle;
})();
var Shot = (function () {
    function Shot(position, direction, lifetime) {
        this.position = position;
        this.direction = direction;
        this.lifetime = lifetime;
        this.shot_speed = 400;
    }
    Shot.prototype.update = function (dt, fieldsize, margin) {
        this.position = this.position.add(this.direction.scale(this.shot_speed * dt));
        if(this.position.x < -margin) {
            this.position.x += fieldsize.x + 2 * margin;
        } else {
            if(this.position.x > fieldsize.x + margin) {
                this.position.x -= fieldsize.x + 2 * margin;
            }
        }
        if(this.position.y < -margin) {
            this.position.y += fieldsize.y + 2 * margin;
        } else {
            if(this.position.y > fieldsize.y + margin) {
                this.position.y -= fieldsize.y + 2 * margin;
            }
        }
        this.lifetime -= dt;
    };
    return Shot;
})();
var Asteroid = (function () {
    function Asteroid(shape, position, rotation, lin_velocity, ang_velocity, level) {
        this.shape = shape;
        this.position = position;
        this.rotation = rotation;
        this.lin_velocity = lin_velocity;
        this.ang_velocity = ang_velocity;
        this.level = level;
    }
    Asteroid.prototype.update = function (dt, fieldsize, margin) {
        this.position = this.position.add(this.lin_velocity.scale(dt));
        if(this.position.x < -margin) {
            this.position.x += fieldsize.x + 2 * margin;
        } else {
            if(this.position.x > fieldsize.x + margin) {
                this.position.x -= fieldsize.x + 2 * margin;
            }
        }
        if(this.position.y < -margin) {
            this.position.y += fieldsize.y + 2 * margin;
        } else {
            if(this.position.y > fieldsize.y + margin) {
                this.position.y -= fieldsize.y + 2 * margin;
            }
        }
        this.rotation = this.rotation + dt * this.ang_velocity;
    };
    Asteroid.prototype.collides = function (ast) {
        var _this = this;
        var points1 = this.shape.points.map(function (p) {
            return p.rotate(_this.rotation).add(_this.position);
        });
        var points2 = ast.shape.points.map(function (p) {
            return p.rotate(ast.rotation).add(ast.position);
        });
        for(var i = 0; i < points1.length - 1; ++i) {
            if(ast.point_inside(points1[i])) {
                var colision_point = this.closest_point_in_polygon(points1[i], points2);
                var normal = points1[i].subtract(colision_point).unit();
                return new Collision(this, ast, colision_point, normal);
            }
        }
        for(var i = 0; i < points2.length - 1; ++i) {
            if(this.point_inside(points2[i])) {
                var colision_point = this.closest_point_in_polygon(points2[i], points1);
                var normal = points2[i].subtract(colision_point).unit();
                return new Collision(ast, this, colision_point, normal);
            }
        }
        return null;
    };
    Asteroid.prototype.point_inside = function (point) {
        return this.shape.point_inside(point.subtract(this.position).rotate(-this.rotation));
    };
    Asteroid.prototype.closest_point_in_polygon = function (point, ppoints) {
        var distance = Number.MAX_VALUE;
        var closest = new Vector(0, 0);
        for(var i = 0; i < ppoints.length - 1; ++i) {
            var start = ppoints[i];
            var end = ppoints[i + 1];
            var closest_aux = this.closest_point_in_segment(point, start, end);
            var dist_aux = closest_aux.subtract(point).norm();
            if(dist_aux < distance) {
                distance = dist_aux;
                closest = closest_aux.scale(1);
            }
        }
        return closest;
    };
    Asteroid.prototype.closest_point_in_segment = function (point, start, end) {
        var t = end.subtract(start);
        var n = t.norm();
        t = t.scale(1 / n);
        var v = point.subtract(start);
        var p = v.dot(t);
        if(p < 0) {
            return start;
        } else {
            if(p > n) {
                return end;
            } else {
                return start.add(t.scale(p));
            }
        }
    };
    return Asteroid;
})();
var AsteroidsGame = (function () {
    function AsteroidsGame(canvas) {
        this.fieldsize = new Vector(600, 400);
        this.margin = 40;
        this.fps = 60;
        this.canvas = canvas;
        this.canvas.width = this.fieldsize.x;
        this.canvas.height = this.fieldsize.y;
        this.renderer = new ClassicAsteroidsRenderer();
    }
    AsteroidsGame.prototype.start = function () {
        var _this = this;
        this.score = 0;
        this.lives = 3;
        this.gameover = false;
        this.asteroids = new Array();
        this.shots = new Array();
        this.time = 0.0;
        this.particles = new Array();
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x / 3, -this.margin), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x / 3 * 2, this.fieldsize.y + this.margin), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(-this.margin, this.fieldsize.y * 2 / 3), 3));
        this.asteroids.push(this.generate_asteroid(new Vector(this.fieldsize.x + this.margin, this.fieldsize.y / 3), 3));
        this.ship = new SpaceShip(this);
        this.ship.alive = true;
        var dt = 1.0 / this.fps;
        this.refresh_interval = setInterval(function () {
            return _this.run();
        }, dt * 1000);
    };
    AsteroidsGame.prototype.stop = function () {
        clearInterval(this.refresh_interval);
    };
    AsteroidsGame.prototype.run = function () {
        var dt = 1.0 / this.fps;
        this.update(dt);
        this.renderer.render(this);
    };
    AsteroidsGame.prototype.update = function (dt) {
        var _this = this;
        this.time += dt;
        this.asteroids.forEach(function (a) {
            return a.update(dt, _this.fieldsize, _this.margin);
        });
        this.shots.forEach(function (s) {
            return s.update(dt, _this.fieldsize, _this.margin);
        });
        this.shots = this.shots.filter(function (s) {
            return s.lifetime > 0;
        });
        this.particles.forEach(function (p) {
            return p.update(dt, _this.fieldsize, _this.margin);
        });
        this.particles = this.particles.filter(function (p) {
            return p.lifetime > 0;
        });
        this.check_shots();
        this.check_asteroid_collisions();
        if(this.ship.alive) {
            this.ship.update(dt, this.fieldsize, this.margin);
            this.check_ship_collisions();
        } else {
            this.ship.death_time_current -= dt;
            if(this.ship.death_time_current < 0 && !this.gameover) {
                this.ship = new SpaceShip(this);
                this.ship.alive = true;
            }
        }
        var sum_levels = 0;
        for(var i = 0; i < this.asteroids.length; ++i) {
            sum_levels += this.asteroids[i].level;
        }
        var max_levels = 10 + Math.log(this.time) * 2;
        if(sum_levels < max_levels && !this.gameover) {
            var position;
            if(Math.random() > 0.5) {
                position = new Vector(Math.round(Math.random()) * (this.fieldsize.x + 2 * this.margin) - this.margin, Math.random() * this.fieldsize.y);
            } else {
                position = new Vector(Math.random() * this.fieldsize.x, Math.round(Math.random()) * (this.fieldsize.y + 2 * this.margin) - this.margin);
            }
            this.asteroids.push(this.generate_asteroid(position, 3));
        }
    };
    AsteroidsGame.prototype.generate_asteroid = function (position, level) {
        var points = [];
        var radius = 10 * Math.pow(2, level - 1);
        var num_vertices = 12;
        for(var i = 0; i < num_vertices; ++i) {
            var r = radius - 0.9 * radius * Math.random() * Math.random() * Math.random();
            var ang = i * 2 * Math.PI / num_vertices;
            points.push(new Vector(r * Math.cos(ang), r * Math.sin(ang)));
        }
        points.push(points[0]);
        var poly = new PolygonShape(points);
        var speed = 50 + Math.random() * 50;
        return new Asteroid(poly, position, 0, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), 2 * (Math.random() - 0.5), level);
    };
    AsteroidsGame.prototype.check_shots = function () {
        for(var i = this.shots.length - 1; i >= 0; --i) {
            for(var j = this.asteroids.length - 1; j >= 0; --j) {
                if(this.asteroids[j].point_inside(this.shots[i].position)) {
                    this.score += 10 * Math.pow(2, this.asteroids[j].level - 1);
                    var rem_asteroid = this.asteroids[j];
                    var rem_shot = this.shots[i];
                    if(rem_asteroid.level > 1) {
                        var level = rem_asteroid.level - 1;
                        var radius = 10 * Math.pow(2, level);
                        var p1 = rem_asteroid.position.add(rem_shot.direction.rotate(Math.PI / 2).scale(radius));
                        var p2 = rem_asteroid.position.add(rem_shot.direction.rotate(-Math.PI / 2).scale(radius));
                        this.asteroids.push(this.generate_asteroid(p1, level));
                        this.asteroids.push(this.generate_asteroid(p2, level));
                    }
                    this.asteroids.splice(j, 1);
                    this.shots.splice(i, 1);
                    break;
                }
            }
        }
    };
    AsteroidsGame.prototype.check_asteroid_collisions = function () {
        for(var i = 0; i < this.asteroids.length; ++i) {
            var r1 = 10 * Math.pow(2, this.asteroids[i].level - 1);
            for(var j = i + 1; j < this.asteroids.length; ++j) {
                var r2 = 10 * Math.pow(2, this.asteroids[j].level - 1);
                var dist = this.asteroids[i].position.subtract(this.asteroids[j].position).norm();
                if(dist < r1 + r2) {
                    var collision = this.asteroids[i].collides(this.asteroids[j]);
                    if(!(collision == null)) {
                        this.handle_collision(collision);
                    }
                }
            }
        }
    };
    AsteroidsGame.prototype.handle_collision = function (collision) {
        var r1c = collision.point.subtract(collision.ast1.position);
        var r1ct = r1c.rotate(Math.PI / 2);
        var r2c = collision.point.subtract(collision.ast2.position);
        var r2ct = r2c.rotate(Math.PI / 2);
        var v1c = collision.ast1.lin_velocity.add(r1ct.scale(collision.ast1.ang_velocity));
        var v2c = collision.ast2.lin_velocity.add(r2ct.scale(collision.ast2.ang_velocity));
        var v12c = v2c.subtract(v1c).dot(collision.normal);
        if(v12c < 0) {
            var e = 1;
            var m1 = collision.ast1.shape.area;
            var m2 = collision.ast2.shape.area;
            var i1 = collision.ast1.shape.moment;
            var i2 = collision.ast2.shape.moment;
            var r1ctn = r1ct.dot(collision.normal);
            var r2ctn = r2ct.dot(collision.normal);
            var vn = v1c.subtract(v2c).dot(collision.normal);
            var j = (1 + e) * vn / ((1 / m1) + (1 / m2) + r1ctn * r1ctn / i1 + r2ctn * r2ctn / i2);
            collision.ast1.lin_velocity = collision.ast1.lin_velocity.subtract(collision.normal.scale(j / m1));
            collision.ast1.ang_velocity -= j * r1ctn / i1;
            collision.ast2.lin_velocity = collision.ast2.lin_velocity.add(collision.normal.scale(j / m2));
            collision.ast2.ang_velocity += j * r2ctn / i2;
        }
    };
    AsteroidsGame.prototype.check_ship_collisions = function () {
        for(var i = 0; i < this.asteroids.length; ++i) {
            if(this.ship.collides(this.asteroids[i])) {
                this.lives--;
                this.ship.alive = false;
                this.ship.death_time_current = this.ship.death_time;
                for(var i = 0; i < 20; ++i) {
                    var speed = 50 + Math.random() * 50;
                    this.particles.push(new Particle(this.ship.position, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), Math.random() * Math.PI, 5 * (Math.random() - 0.5), 0.5 + Math.random() * 0.5));
                }
                if(this.lives <= 0) {
                    this.gameover = true;
                    for(var j = 0; j < this.asteroids.length; ++j) {
                        var num_particles = 20 * Math.pow(2, this.asteroids[j].level - 1);
                        var radius = 10 * Math.pow(2, this.asteroids[j].level - 1);
                        for(var i = 0; i < num_particles; ++i) {
                            var speed = 50 + Math.random() * 50;
                            var position = this.asteroids[j].position.add(new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(radius));
                            this.particles.push(new Particle(position, new Vector((Math.random() - 0.5), (Math.random() - 0.5)).unit().scale(speed), Math.random() * Math.PI, 5 * (Math.random() - 0.5), 1 + Math.random() * 1));
                        }
                    }
                    this.asteroids = new Array();
                }
            }
        }
    };
    return AsteroidsGame;
})();
var ClassicAsteroidsRenderer = (function () {
    function ClassicAsteroidsRenderer() { }
    ClassicAsteroidsRenderer.prototype.render = function (game) {
        var context = game.canvas.getContext("2d");
        context.fillStyle = "#000000";
        context.fillRect(0, 0, game.fieldsize.x, game.fieldsize.y);
        for(var i = 0; i < game.asteroids.length; ++i) {
            this.render_asteroid(context, game.asteroids[i]);
        }
        if(game.ship.alive) {
            this.render_ship(context, game.ship);
        }
        for(var i = 0; i < game.shots.length; ++i) {
            this.render_shot(context, game.shots[i]);
        }
        for(var i = 0; i < game.particles.length; ++i) {
            this.render_particle(context, game.particles[i]);
        }
        context.fillStyle = "#FFFFFF";
        if(game.gameover) {
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
    };
    ClassicAsteroidsRenderer.prototype.render_asteroid = function (context, asteroid) {
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.translate(asteroid.position.x, asteroid.position.y);
        context.rotate(asteroid.rotation);
        context.beginPath();
        context.moveTo(asteroid.shape.points[0].x, asteroid.shape.points[0].y);
        for(var i = 1; i < asteroid.shape.points.length; ++i) {
            context.lineTo(asteroid.shape.points[i].x, asteroid.shape.points[i].y);
        }
        context.closePath();
        context.stroke();
        context.rotate(-asteroid.rotation);
        context.translate(-asteroid.position.x, -asteroid.position.y);
    };
    ClassicAsteroidsRenderer.prototype.render_ship = function (context, ship) {
        var p = ship.shape.points;
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.translate(ship.position.x, ship.position.y);
        context.rotate(ship.rotation);
        context.beginPath();
        context.moveTo(p[0].x, p[0].y);
        for(var i = 1; i < p.length; ++i) {
            context.lineTo(p[i].x, p[i].y);
        }
        context.stroke();
        var p1 = p[0].add(p[1].subtract(p[0]).scale(0.2));
        var p2 = p[2].add(p[1].subtract(p[2]).scale(0.2));
        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.stroke();
        if(ship.is_accelerating) {
            var p3 = new Vector(0.5 * (p1.x + p2.x), p1.y - 10);
            context.beginPath();
            context.moveTo(p1.x - 3, p1.y);
            context.lineTo(p3.x, p3.y);
            context.lineTo(p2.x + 3, p2.y);
            context.stroke();
        }
        context.rotate(-ship.rotation);
        context.translate(-ship.position.x, -ship.position.y);
    };
    ClassicAsteroidsRenderer.prototype.render_particle = function (context, particle) {
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
    };
    ClassicAsteroidsRenderer.prototype.render_shot = function (context, shot) {
        context.strokeStyle = "#FFFFFF";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(shot.position.x, shot.position.y);
        var p = shot.position.add(shot.direction.scale(5));
        context.lineTo(p.x, p.y);
        context.stroke();
    };
    return ClassicAsteroidsRenderer;
})();
var asteroids_app;
function start() {
    var canvas = document.getElementById('canvas');
    asteroids_app = new AsteroidsGame(canvas);
    asteroids_app.start();
}
window.onload = start;
window.onkeydown = function (ev) {
    switch(ev.keyCode) {
        case 38: {
            if(asteroids_app.ship.alive) {
                asteroids_app.ship.is_accelerating = true;
            }
            break;

        }
        case 39: {
            if(asteroids_app.ship.alive && asteroids_app.ship.is_rotating < 1) {
                asteroids_app.ship.is_rotating++;
            }
            break;

        }
        case 37: {
            if(asteroids_app.ship.alive && asteroids_app.ship.is_rotating > -1) {
                asteroids_app.ship.is_rotating--;
            }
            break;

        }
    }
};
window.onkeyup = function (ev) {
    switch(ev.keyCode) {
        case 38: {
            if(asteroids_app.ship.alive) {
                asteroids_app.ship.is_accelerating = false;
            }
            break;

        }
        case 39: {
            if(asteroids_app.ship.alive && asteroids_app.ship.is_rotating > -1) {
                asteroids_app.ship.is_rotating--;
            }
            break;

        }
        case 37: {
            if(asteroids_app.ship.alive && asteroids_app.ship.is_rotating < 1) {
                asteroids_app.ship.is_rotating++;
            }
            break;

        }
        case 32: {
            if(asteroids_app.gameover) {
                asteroids_app.stop();
                start();
            } else {
                if(asteroids_app.ship.alive) {
                    asteroids_app.shots.push(asteroids_app.ship.shoot());
                }
            }
            break;

        }
    }
};
