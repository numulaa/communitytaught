import mongoose from "mongoose";

import Lesson from '../models/Lesson.js';
import User from '../models/User.js';

export const addEditLessonForm = async (req, res) => {
	if (!req.isAuthenticated() || !req.user.admin) return res.redirect("/");
	const edit = !!req.params.id;
	let lesson = null;
	if (edit) {
		lesson = await Lesson.findById(req.params.id).lean();
		lesson.classNo = lesson.classNo.join(',');
		lesson.dates = lesson.dates.map(date => {
			return date.toISOString().split('T')[0];
		}).join(",");
		lesson.slides = lesson.slides.map(slide => {
			return `${slide.class}-${slide.link}`
		}).join(",");
	}
	res.render("addLesson", { edit, lesson });
};

export const addEditLesson = async (req, res) => {
	if (!req.isAuthenticated() || !req.user.admin) return res.redirect("/");
	try{
		let dates = [];
		if (req.body.date) {
			dates = req.body.date.split(',').map(date => new Date(date));
		}
		let slides = [];
		if (req.body.slides) {
			slides =  req.body.slides.split(',').map(slide => {
				const data = slide.split("-");
				return {
					class: Number(data[0]),
					link: data[1]
				}
			});
		}
		const timestamps = [];
		for (let i = 0; i < req.body.tsTime.length; i++) {
			timestamps.push({
				time: Number(req.body.tsTime[i]),
				title: req.body.tsTitle[i],
			});
		}
		const lesson = {
			videoId: req.body.videoId,
			title: req.body.videoTitle,
			dates: dates,
			permalink: req.body.permalink,
			thumbnail: req.body.thumbnail,
			classNo: req.body.number.split(","),
			slides: slides,
			materials: req.body.materials,
			checkin: req.body.checkin,
			motivationLink: req.body.motivationLink,
			motivationTitle: req.body.motivationTitle,
			cohort: req.body.cohort,
			timestamps: timestamps
		}
		await Lesson.findByIdAndUpdate(req.params.id  || mongoose.Types.ObjectId(), lesson, {upsert: true});
		req.session.flash = { type: "success", message: [`Class ${!!req.params.id ? "updated" : "added"}`]};
	} catch (err) {
		console.log(err);
		req.session.flash = { type: "error", message: [`Class not ${!!req.params.id ? "updated" : "added"}`]};
	} finally {
		res.redirect("/class/add");
	}
};

export const allLessons =  async (req, res) => {
	const lessons = await Lesson.find().lean();
	if (req.isAuthenticated()) {
		const user = await User.findById(req.user.id);
		lessons.map(lesson => {
			const progress = user.lessonProgress.find(prog => {
				return prog.lessonId.toString() === lesson._id.toString();
			})
			if (!progress) {
				lesson.watched = false;
				lesson.checkedIn = false;
			} else {
				lesson.watched = progress.watched;
				lesson.checkedIn = progress.checkedIn;
			}	
			return lesson;
		})
	}
	res.render('allLessons', {lessons})
};

export const showLesson =  async (req, res) => {
	try {
		const lesson = await Lesson.findOne({permalink: req.params.permalink});
		let progress;
		if (req.user) {
			const user = await User.findById(req.user.id);
			progress = user.lessonProgress.find(less => {
				return less.lessonId.toString() === lesson._id.toString();
			});
			if (!progress) {
				progress = { lessonId: lesson._id, watched: false, checkedIn: false };
				user.lessonProgress.push(progress);
				await user.save();
			}
		}
		let next = await Lesson.findOne({classNo: {$in: [lesson.classNo.at(-1) + 1]}});
		next = next ? next.permalink : null;
		let prev = await Lesson.findOne({classNo: {$in: [lesson.classNo[0] - 1]}});
		prev = prev ? prev.permalink : null;
		res.render('lesson', { lesson, next, prev, progress });
	} catch (err) {
		console.log(err);
	}	
};

export const toggleWatched =  async (req, res) => {
	try {
		await User.toggleWatched(req.params.id, req.user.id);
		res.json("toggled watched");
	} catch (err) {
		console.log(err)
		res.json(err);
	} 	
};

export const toggleCheckedIn =  async (req, res) => {
	try {
		await User.toggleCheckedIn(req.params.id, req.user.id);
		res.json("toggled checked in");
	} catch (err) {
		console.log(err)
		res.json(err);
	} 
};