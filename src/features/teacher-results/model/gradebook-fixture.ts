import type { CourseGradebookResponse } from '../../../api/education/model';

export const book: CourseGradebookResponse = {
  practicals: [
    { id: 'p1', name: 'Практика 1', isExternal: false, moduleId: 'm1', moduleName: 'Модуль А' },
    { id: 'p2', name: 'SQL; "джойны"', isExternal: true, moduleId: 'm1', moduleName: 'Модуль А' },
  ],
  students: [
    {
      studentId: 's1', studentName: 'Иванов Иван', login: 'ivanov', group: 'ИС-21',
      cells: [
        { practicalId: 'p1', assigned: true, grade: 5, status: 'passed' },
        { practicalId: 'p2', assigned: true, grade: 4, status: 'passed' },
      ],
      assignedCount: 2, passedCount: 2, averageGrade: 4.5,
    },
    {
      studentId: 's2', studentName: 'Петров Пётр', login: 'petrov', group: null,
      cells: [
        { practicalId: 'p1', assigned: true, grade: 2, status: 'failed' },
        { practicalId: 'p2', assigned: false, grade: null, status: 'incomplete' },
      ],
      assignedCount: 1, passedCount: 0, averageGrade: 2,
    },
    {
      studentId: 's3', studentName: 'Сидоров Сидор', login: 'sidorov', group: null,
      cells: [
        { practicalId: 'p1', assigned: true, grade: null, status: 'incomplete' },
        { practicalId: 'p2', assigned: true, grade: 3, status: 'passed' },
      ],
      assignedCount: 2, passedCount: 1, averageGrade: 3,
    },
  ],
};
