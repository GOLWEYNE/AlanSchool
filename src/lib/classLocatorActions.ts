"use server";

import prisma from "./prisma";
import { createClass, updateClass } from "./actions";
import { setClassRoom } from "./classLocator";
import { ClassSchema } from "./formValidationSchemas";

// The room number is stored beside the class (see classLocator.ts), so these
// wrappers run the normal create/update first (which does the admin check) and
// only save the room when that succeeded.
type State = Parameters<typeof createClass>[0];
type ClassWithRoom = ClassSchema & { roomNumber?: string };

export const createClassWithRoom = async (state: State, data: ClassWithRoom) => {
  const { roomNumber, ...classData } = data;
  const result = await createClass(state, classData);
  if (result.success) {
    try {
      const created = await prisma.class.findUnique({
        where: { name: classData.name },
        select: { id: true },
      });
      if (created) await setClassRoom(created.id, roomNumber);
    } catch (err) {
      console.log(err);
    }
  }
  return result;
};

export const updateClassWithRoom = async (state: State, data: ClassWithRoom) => {
  const { roomNumber, ...classData } = data;
  const result = await updateClass(state, classData);
  if (result.success && classData.id) {
    try {
      await setClassRoom(classData.id, roomNumber);
    } catch (err) {
      console.log(err);
    }
  }
  return result;
};
